"""Nabu 1.4: durable sync, one-use recovery and moderated collaboration.
No provider keys, passwords, private notes or review histories enter shared entries.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Literal
from fastapi import Depends, HTTPException, Request, Response
from pydantic import Field, ValidationError
from social import (Model, Content, Card, Add, Edit, Archive, Grade, Commit, Schedule,
                    now, dump, identity, review_card)

SCHEMA = """
CREATE TABLE IF NOT EXISTS recovery_codes (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 digest TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_receipts (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL, request_hash TEXT NOT NULL, result TEXT NOT NULL, at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE TABLE IF NOT EXISTS collection_roles (
 library_id TEXT NOT NULL REFERENCES shared_libraries(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('viewer','contributor')),
 PRIMARY KEY(library_id,user_id),
 FOREIGN KEY(library_id,user_id) REFERENCES library_members(library_id,user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collection_proposals (
 id TEXT PRIMARY KEY, library_id TEXT NOT NULL REFERENCES shared_libraries(id) ON DELETE CASCADE,
 author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 entry_id TEXT, body TEXT NOT NULL, base_revision INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at INTEGER NOT NULL, decided_at INTEGER
);
CREATE TABLE IF NOT EXISTS collection_events (
 id TEXT PRIMARY KEY, library_id TEXT NOT NULL REFERENCES shared_libraries(id) ON DELETE CASCADE,
 actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 kind TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL
);
PRAGMA user_version=3;
"""

def make_recovery(conn, uid):
    token = secrets.token_urlsafe(32)
    conn.execute('INSERT OR REPLACE INTO recovery_codes VALUES(?,?,?)',
                 (uid, hashlib.sha256(token.encode()).hexdigest(), now()))
    return token

class Password(Model):
    password: str = Field(min_length=1, max_length=128)

class Recover(Model):
    handle: str = Field(pattern=r'^[A-Za-z0-9_]{3,24}$')
    code: str = Field(min_length=20, max_length=128)
    password: str = Field(min_length=12, max_length=128)

class Operation(Model):
    id: uuid.UUID
    kind: Literal['add','translation','edit','archive','review','undo']
    payload: dict
    at: int = Field(ge=946684800000, le=7258118400000)

class Membership(Model):
    handle: str = Field(pattern=r'^[A-Za-z0-9_]{3,24}$')
    role: Literal['viewer','contributor']

class PublicEntry(Model):
    front: str = Field(min_length=1,max_length=10000)
    back: str = Field(min_length=1,max_length=10000)
    sourceLang: str
    targetLang: str
    context: str = Field(default='',max_length=1500)
    conceptId: str = Field(default='',max_length=100)
    literal: str = Field(default='',max_length=1500)
    usage: str = Field(default='',max_length=1500)
    example: str = Field(default='',max_length=1500)
    reply: str = Field(default='',max_length=1500)
    provenance: str = Field(default='',max_length=300)
    reviewStatus: Literal['draft','machine','contributor']='contributor'

class Proposal(Model):
    entryId: uuid.UUID | None = None
    revision: int = Field(ge=1)
    entry: PublicEntry

class Verdict(Model):
    status: Literal['accepted','declined']
    revision: int = Field(ge=1)


def install_upgrades(app, connection, authenticated, rate, ip_key,
                     password_hash, password_matches, dummy_hash, social):
    get_card = social['get_card']; save = social['save']
    existing = social['existing']; expect_revision = social['expect_revision']
    accessible = social['accessible']

    def snapshot(conn,uid):
        return {
            'cards':[json.loads(r[0]) for r in conn.execute('SELECT body FROM cloud_cards WHERE owner_id=? ORDER BY id',(uid,))],
            'logs':[json.loads(r[0]) for r in conn.execute('SELECT body FROM cloud_logs WHERE owner_id=? ORDER BY at DESC LIMIT 10000',(uid,))],
            'history':[json.loads(r[0]) for r in conn.execute('SELECT body FROM cloud_history WHERE owner_id=? ORDER BY at DESC LIMIT 50',(uid,))]
        }

    @app.post('/api/account/recovery')
    def rotate_recovery(data:Password,user=Depends(authenticated)):
        uid=user['user_id'];rate('recovery-rotate',uid,6,3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row=conn.execute('SELECT password_hash FROM users WHERE id=?',(uid,)).fetchone()
            if not row or not password_matches(data.password,row[0]):
                raise HTTPException(403,'Your current password is incorrect.')
            code=make_recovery(conn,uid);conn.commit()
        return {'recoveryCode':code}

    @app.post('/api/recover')
    def recover(data:Recover,request:Request,response:Response):
        rate('recover-ip',ip_key(request),10,900)
        rate('recover-handle',data.handle.lower(),6,900)
        # Always do the expensive password derivation, including for unknown handles.
        new_hash=password_hash(data.password)
        supplied=hashlib.sha256(data.code.strip().encode()).hexdigest()
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row=conn.execute('SELECT u.id,r.digest FROM users u LEFT JOIN recovery_codes r ON r.user_id=u.id WHERE u.handle=?',(data.handle.lower(),)).fetchone()
            expected=row['digest'] if row and row['digest'] else '0'*64
            if not hmac.compare_digest(supplied,expected) or not row:
                raise HTTPException(400,'The handle or recovery code is incorrect, expired or already used.')
            uid=row['id']
            conn.execute('UPDATE users SET password_hash=? WHERE id=?',(new_hash,uid))
            conn.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
            conn.execute('DELETE FROM extension_tokens WHERE owner_id=?',(uid,))
            code=make_recovery(conn,uid);conn.commit()
        response.delete_cookie('nabu_session',path='/')
        return {'ok':True,'recoveryCode':code}

    @app.post('/api/sync')
    def sync(data:Operation,user=Depends(authenticated)):
        uid=user['user_id'];rate('sync',uid,3000,3600)
        body=data.model_dump(mode='json');digest=hashlib.sha256(dump(body).encode()).hexdigest()
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            previous=conn.execute('SELECT * FROM sync_receipts WHERE owner_id=? AND id=?',(uid,str(data.id))).fetchone()
            if previous:
                if not hmac.compare_digest(previous['request_hash'],digest):
                    raise HTTPException(409,'This operation ID was already used for different content.')
                result=json.loads(previous['result'])
                view=snapshot(conn,uid);conn.commit()
                return {'result':result,'snapshot':view,'replayed':True}
            # 5-minute future tolerance for imperfect device clocks; old reviews retain
            # their actual occurrence time. A stale revision is never silently rebased.
            if data.at > now()+300000:
                raise HTTPException(422,'Your device clock is ahead. Correct it before syncing.')
            p=data.payload; mapping={}
            try:
                if data.kind in ('add','translation'):
                    model=Add.model_validate(p) if data.kind=='add' else Commit.model_validate(p)
                    models=model.cards if data.kind=='add' else [model.card]
                    cards=[];added=0;restored=False
                    for m in models:
                        incoming=m.model_dump(mode='json');old=existing(conn,uid,incoming)
                        if old:
                            mapping[incoming['id']]=old['id']
                            card=old
                            if data.kind=='translation' and old['archived']:
                                card=save(conn,uid,{**old,'archived':False},old);restored=True
                        else:
                            card=save(conn,uid,incoming);added+=1
                        cards.append(card)
                    result={'cards':cards,'added':added,'duplicates':len(cards)-added,'idMap':mapping}
                    if data.kind=='translation':
                        card=cards[0]
                        entry={**social['public_card'](card),'id':identity(card),'provider':model.provider,'at':data.at}
                        conn.execute('INSERT OR REPLACE INTO cloud_history VALUES(?,?,?,?)',(uid,entry['id'],dump(entry),data.at))
                        conn.execute('DELETE FROM cloud_history WHERE owner_id=? AND identity NOT IN(SELECT identity FROM cloud_history WHERE owner_id=? ORDER BY at DESC LIMIT 50)',(uid,uid))
                        result={'card':card,'added':bool(added),'restored':restored,'idMap':mapping}
                elif data.kind in ('edit','archive','review'):
                    cid=str(uuid.UUID(p['cardId']));old=get_card(conn,uid,cid)
                    inner={k:v for k,v in p.items() if k!='cardId'}
                    model={'edit':Edit,'archive':Archive,'review':Grade}[data.kind].model_validate(inner)
                    expect_revision(old,model.revision)
                    if data.kind=='edit':
                        card=save(conn,uid,{**old,**model.content.model_dump()},old);result=card
                    elif data.kind=='archive':
                        card=save(conn,uid,{**old,'archived':model.archived},old);result=card
                    else:
                        if old['archived']:raise HTTPException(409,'This card is archived.')
                        card=save(conn,uid,review_card(old,model.rating,data.at,model.practiceMode),old)
                        log={'id':str(data.id),'cardId':cid,'at':data.at,'rating':model.rating,
                             'before':old,'afterRevision':card['revision'],'durationMs':model.durationMs,'practiceMode':model.practiceMode}
                        conn.execute('INSERT INTO cloud_logs VALUES(?,?,?,?,?)',(uid,log['id'],cid,dump(log),data.at))
                        result={'card':card,'log':log}
                else:
                    if set(p)!={'logId'}:raise ValueError('Undo needs a review identifier.')
                    lid=str(uuid.UUID(p['logId']))
                    row=conn.execute('SELECT body FROM cloud_logs WHERE owner_id=? AND id=?',(uid,lid)).fetchone()
                    if not row:raise HTTPException(404,'Review not found.')
                    log=json.loads(row[0]);old=get_card(conn,uid,log['cardId']);expect_revision(old,log['afterRevision'])
                    save(conn,uid,log['before'],old)
                    conn.execute('DELETE FROM cloud_logs WHERE owner_id=? AND id=?',(uid,lid));result={'ok':True}
            except (ValidationError,ValueError,KeyError,TypeError):
                raise HTTPException(422,'Invalid sync operation. Export pending changes before removing it.')
            conn.execute('INSERT INTO sync_receipts VALUES(?,?,?,?,?)',(uid,str(data.id),digest,dump(result),now()))
            view=snapshot(conn,uid);conn.commit()
        return {'result':result,'snapshot':view,'replayed':False}

    def role(conn,row,uid):
        if row['owner_id']==uid:return 'owner'
        r=conn.execute('SELECT role FROM collection_roles WHERE library_id=? AND user_id=?',(row['id'],uid)).fetchone()
        return r[0] if r else 'viewer'

    def entries(row):
        cards=json.loads(row['cards_json'])
        for i,c in enumerate(cards):
            c.setdefault('entryId',str(uuid.uuid5(uuid.UUID(row['id']),str(i)+identity(c))))
        return cards

    def event(conn,lid,uid,kind,revision,body):
        conn.execute('INSERT INTO collection_events VALUES(?,?,?,?,?,?,?)',
                     (str(uuid.uuid4()),lid,uid,kind,revision,dump(body),now()))

    @app.get('/api/shared-libraries/{lid}/collaboration')
    def collaboration(lid:uuid.UUID,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            row=accessible(conn,uid,lid);r=role(conn,row,uid)
            members=[dict(x) for x in conn.execute('SELECT u.handle,coalesce(r.role,\'viewer\') role FROM library_members m JOIN users u ON u.id=m.user_id LEFT JOIN collection_roles r ON r.library_id=m.library_id AND r.user_id=m.user_id WHERE m.library_id=?',(str(lid),))]
            proposals=[]
            for x in conn.execute('SELECT p.*,u.handle FROM collection_proposals p LEFT JOIN users u ON u.id=p.author_id WHERE p.library_id=? ORDER BY p.created_at DESC LIMIT 100',(str(lid),)):
                if x['author_id'] and x['author_id']!=uid and social['blocked'](conn,uid,x['author_id']):continue
                if r=='owner' or x['author_id']==uid or x['status']=='accepted':
                    proposals.append({'id':x['id'],'author':x['handle'] or 'Deleted account','entryId':x['entry_id'],
                                      'entry':json.loads(x['body']),'revision':x['base_revision'],'status':x['status'],'createdAt':x['created_at']})
            events=[]
            for x in conn.execute('SELECT e.*,u.handle FROM collection_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.library_id=? ORDER BY e.at DESC LIMIT 40',(str(lid),)):
                events.append({'kind':x['kind'],'actor':x['handle'] or 'Deleted account','revision':x['revision'],'at':x['at'],'changes':json.loads(x['body'])})
            return {'role':r,'revision':row['revision'],'entries':entries(row),'members':members if r=='owner' else [],'proposals':proposals,'events':events}

    @app.put('/api/shared-libraries/{lid}/members')
    def membership(lid:uuid.UUID,data:Membership,user=Depends(authenticated)):
        uid=user['user_id'];rate('collection-members',uid,100,3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=accessible(conn,uid,lid)
            if row['owner_id']!=uid:raise HTTPException(403,'Only the owner can change permissions.')
            target=conn.execute('SELECT id FROM users WHERE handle=?',(data.handle.lower(),)).fetchone()
            if not target or not social['friends'](conn,uid,target['id']):raise HTTPException(403,'Choose an accepted friend.')
            conn.execute('INSERT OR IGNORE INTO library_members VALUES(?,?)',(str(lid),target['id']))
            conn.execute('INSERT OR REPLACE INTO collection_roles VALUES(?,?,?)',(str(lid),target['id'],data.role))
            event(conn,str(lid),uid,'permission',row['revision'],{'handle':data.handle.lower(),'role':data.role});conn.commit()
        return {'ok':True}

    @app.post('/api/shared-libraries/{lid}/proposals',status_code=201)
    def propose(lid:uuid.UUID,data:Proposal,user=Depends(authenticated)):
        uid=user['user_id'];rate('collection-proposals',uid,100,3600)
        try:raw=Content.model_validate(data.entry.model_dump()).model_dump()
        except ValidationError:raise HTTPException(422,'Use distinct supported languages and non-empty word and meaning fields.')
        content={k:v for k,v in raw.items() if k in PublicEntry.model_fields}
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=accessible(conn,uid,lid)
            if role(conn,row,uid) not in ('owner','contributor'):raise HTTPException(403,'Ask the owner for contributor access.')
            if row['revision']!=data.revision:raise HTTPException(409,'The collection changed. Reopen it before proposing changes.')
            if data.entryId and str(data.entryId) not in {c['entryId'] for c in entries(row)}:raise HTTPException(404,'Shared entry not found.')
            if conn.execute("SELECT count(*) FROM collection_proposals WHERE library_id=? AND status='pending'",(str(lid),)).fetchone()[0]>=100:raise HTTPException(409,'Review pending proposals before adding more.')
            pid=str(uuid.uuid4());conn.execute('INSERT INTO collection_proposals VALUES(?,?,?,?,?,?,?,?,?)',
              (pid,str(lid),uid,str(data.entryId) if data.entryId else None,dump(content),data.revision,'pending',now(),None))
            conn.commit()
        return {'id':pid}

    @app.patch('/api/shared-libraries/{lid}/proposals/{pid}')
    def decide(lid:uuid.UUID,pid:uuid.UUID,data:Verdict,user=Depends(authenticated)):
        uid=user['user_id'];rate('collection-decisions',uid,200,3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=accessible(conn,uid,lid)
            if row['owner_id']!=uid:raise HTTPException(403,'Only the owner approves changes.')
            proposal=conn.execute("SELECT * FROM collection_proposals WHERE id=? AND library_id=? AND status='pending'",(str(pid),str(lid))).fetchone()
            if not proposal:raise HTTPException(404,'Proposal not found or already decided.')
            revision=row['revision']
            if data.status=='accepted':
                author=proposal['author_id']
                if not author or (author!=uid and (not social['friends'](conn,uid,author) or not conn.execute('SELECT 1 FROM library_members WHERE library_id=? AND user_id=?',(str(lid),author)).fetchone())):
                    raise HTTPException(403,'The contributor no longer has access. Decline this proposal.')
                if revision!=data.revision or proposal['base_revision']!=revision:
                    raise HTTPException(409,'This proposal is stale. The contributor must resubmit against the current collection.')
                cards=entries(row);before=None;new=json.loads(proposal['body'])
                new['entryId']=proposal['entry_id'] or str(uuid.uuid4())
                if proposal['entry_id']:
                    for i,c in enumerate(cards):
                        if c['entryId']==proposal['entry_id']:before=c;cards[i]=new;break
                    if before is None:raise HTTPException(409,'The entry was removed since this proposal.')
                    if any(c['entryId']!=new['entryId'] and identity(c)==identity(new) for c in cards):
                        raise HTTPException(409,'This correction would duplicate another entry in the collection.')
                else:
                    if len(cards)>=300:raise HTTPException(409,'This collection has reached 300 entries.')
                    if any(identity(c)==identity(new) for c in cards):raise HTTPException(409,'This entry already exists.')
                    cards.append(new)
                revision+=1
                conn.execute('UPDATE shared_libraries SET cards_json=?,revision=?,updated_at=? WHERE id=?',(dump(cards),revision,now(),str(lid)))
                event(conn,str(lid),uid,'approved',revision,{'before':before,'after':new})
            conn.execute('UPDATE collection_proposals SET status=?,decided_at=? WHERE id=?',(data.status,now(),str(pid)));conn.commit()
        return {'ok':True,'revision':revision}

    @app.get('/api/activity')
    def activity(user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            pending=conn.execute("SELECT count(*) FROM collection_proposals p JOIN shared_libraries l ON l.id=p.library_id WHERE l.owner_id=? AND p.status='pending'",(uid,)).fetchone()[0]
        return {'pendingProposals':pending}
