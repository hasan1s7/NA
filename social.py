"""Account libraries, reciprocal friendships and private collection snapshots.
All lookups are scoped by the authenticated session. Share payloads exclude notes,
review schedules and history. SQLite is intended for one persistent server instance.
"""
from __future__ import annotations
import json, re, time, unicodedata, uuid
from typing import Literal
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

LANGUAGES = {'en','es','fr','ar','zh-CN','ru','de','it','ja','ko','pt','tr'}
SCHEMA = """
CREATE TABLE IF NOT EXISTS cloud_cards (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL, identity TEXT NOT NULL, body TEXT NOT NULL, revision INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id), UNIQUE(owner_id,identity)
);
CREATE TABLE IF NOT EXISTS cloud_logs (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL, card_id TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id),
 FOREIGN KEY(owner_id,card_id) REFERENCES cloud_cards(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cloud_history (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 identity TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,identity)
);
CREATE TABLE IF NOT EXISTS friendships (
 id TEXT PRIMARY KEY,
 requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 low_id TEXT NOT NULL, high_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
 created_at INTEGER NOT NULL, UNIQUE(low_id,high_id), CHECK(requester_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS friendship_recipient ON friendships(recipient_id,status);
CREATE TABLE IF NOT EXISTS shared_libraries (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL, cards_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS library_members (
 library_id TEXT NOT NULL REFERENCES shared_libraries(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(library_id,user_id)
);
PRAGMA user_version=2;
"""

def now(): return int(time.time()*1000)
def dump(value): return json.dumps(value, ensure_ascii=False, separators=(',',':'))
def normalize(value): return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC',value).strip()).lower()
def identity(card):
    if card.get('conceptId'):
        return '\x1f'.join(['concept',card['conceptId'],card['sourceLang'],card['targetLang']])
    return '\x1f'.join([card['sourceLang'],card['targetLang'],normalize(card['front']),normalize(card['back'])])

class Model(BaseModel):
    model_config=ConfigDict(extra='forbid', allow_inf_nan=False)

class Schedule(Model):
    algorithm: Literal['nabu-srs-v1']='nabu-srs-v1'
    state: Literal['new','learning','review','relearning']='new'
    step: int=Field(default=0,ge=0,le=10)
    due: int=Field(ge=0,le=8640000000000000)
    interval: float=Field(default=0,ge=0,le=36500)
    ease: float=Field(default=2.5,ge=1.3,le=3.5)
    reps: int=Field(default=0,ge=0,le=10000000)
    lapses: int=Field(default=0,ge=0,le=10000000)
    lastReview: int|None=Field(default=None,ge=0,le=8640000000000000)

class Content(Model):
    front: str=Field(min_length=1,max_length=10000)
    back: str=Field(min_length=1,max_length=10000)
    sourceLang: str
    targetLang: str
    context: str=Field(default='',max_length=1500)
    note: str=Field(default='',max_length=1000)
    deck: str=Field(default='My words',min_length=1,max_length=64)
    tags: list[str]=Field(default_factory=list,max_length=12)
    attribution: str=Field(default='',max_length=80)
    conceptId: str=Field(default='',max_length=100)
    learningMode: Literal['learning','reference']='learning'
    literal: str=Field(default='',max_length=1500)
    usage: str=Field(default='',max_length=1500)
    example: str=Field(default='',max_length=1500)
    reply: str=Field(default='',max_length=1500)
    provenance: str=Field(default='',max_length=300)
    imageId: str=Field(default='',max_length=40,pattern=r'^(?:[a-z0-9_-]+)?$')
    imageDismissed: list[str]=Field(default_factory=list,max_length=24)
    reading: str=Field(default='',max_length=1000)
    readingMethod: str=Field(default='',max_length=80)
    reviewStatus: Literal['draft','machine','contributor']='draft'

    @field_validator('imageDismissed')
    @classmethod
    def valid_dismissed_images(cls, value):
        if any(not re.fullmatch(r'[a-z0-9_-]{1,40}', item) for item in value):
            raise ValueError('Invalid illustration identifier.')
        return list(dict.fromkeys(value))

    @field_validator('front','back','context','note','deck','attribution','conceptId','literal','usage','example','reply','provenance','reading','readingMethod')
    @classmethod
    def clean(cls,value):
        value=unicodedata.normalize('NFC',value).strip()
        if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',value): raise ValueError('Invalid control character.')
        return value

    @field_validator('tags')
    @classmethod
    def tags_valid(cls,value):
        if any(not isinstance(t,str) or len(t)>32 or re.search(r'[\x00-\x1f]',t) for t in value): raise ValueError('Invalid tag.')
        return list(dict.fromkeys(t.strip() for t in value if t.strip()))

    @model_validator(mode='after')
    def valid(self):
        if not self.front or not self.back or not self.deck: raise ValueError('Word, meaning and collection are required.')
        if self.sourceLang not in LANGUAGES or self.targetLang not in LANGUAGES or self.sourceLang==self.targetLang: raise ValueError('Choose two supported, different languages.')
        if self.conceptId and not re.fullmatch(r'[a-z]+\.[a-z_]+',self.conceptId): raise ValueError('Invalid concept.')
        return self

class Card(Content):
    id: uuid.UUID
    createdAt: int=Field(ge=0,le=8640000000000000)
    updatedAt: int=Field(ge=0,le=8640000000000000)
    revision: int=Field(default=0,ge=0,le=10000000)
    archived: bool=False
    schedule: Schedule
    skills: dict[Literal['recognition','production','listening','cloze'],Schedule]=Field(default_factory=dict)

class Add(Model):
    cards: list[Card]=Field(min_length=1,max_length=50)
class Edit(Model):
    content: Content
    revision: int=Field(ge=0)
class Archive(Model):
    archived: bool
    revision: int=Field(ge=0)
class Grade(Model):
    practiceMode: Literal['recognition','production','listening','cloze']='recognition'
    revision: int=Field(ge=0)
    rating: int=Field(ge=1,le=4)
    durationMs: int=Field(default=0,ge=0,le=86400000)
class Commit(Model):
    card: Card
    provider: str=Field(default='',max_length=80)
class Friend(Model):
    handle: str=Field(pattern=r'^[A-Za-z0-9_]{3,24}$')
class Decision(Model):
    status: Literal['accepted','declined']
class Publish(Model):
    title: str=Field(min_length=1,max_length=64)
    description: str=Field(default='',max_length=280)
    cardIds: list[uuid.UUID]=Field(min_length=1,max_length=300)
    recipients: list[str]=Field(min_length=1,max_length=30)
    @field_validator('title','description')
    @classmethod
    def trim(cls,value):
        value=value.strip()
        if re.search(r'[\x00-\x1f]',value): raise ValueError('Invalid text.')
        return value
    @field_validator('recipients')
    @classmethod
    def handles(cls,value):
        if any(not re.fullmatch(r'[A-Za-z0-9_]{3,24}',v) for v in value): raise ValueError('Invalid handle.')
        return list(dict.fromkeys(v.lower() for v in value))
class Refresh(Model):
    cardIds: list[uuid.UUID]=Field(min_length=1,max_length=300)
    revision: int=Field(ge=1)

# Same documented SRS policy as nabu-core.js; server is authoritative for account reviews.
def schedule_review(schedule,rating,at):
    import math
    s=dict(schedule);s['reps']+=1;s['lastReview']=at
    minute=60000;day=86400000
    if s['state'] in ('new','learning'):
        s['state']='learning'
        if rating==1: s['step']=0;delay=minute
        elif rating==2: delay=5*minute
        elif rating==3 and schedule['step']<1: s['step']=1;delay=10*minute
        elif rating==3: s['state']='review';s['interval']=1;delay=day
        else: s['state']='review';s['interval']=4;delay=4*day
    elif s['state']=='relearning':
        if rating==1: delay=minute
        elif rating==2: delay=5*minute
        else:
            s['state']='review';s['interval']=max(1,math.floor(schedule['interval']*(0.8 if rating==4 else 0.5)+0.5));delay=s['interval']*day
    else:
        if rating==1:
            s['state']='relearning';s['step']=0;s['lapses']+=1;s['ease']=max(1.3,s['ease']-0.2);delay=10*minute
        else:
            hard=max(schedule['interval']+1,math.ceil(schedule['interval']*1.2))
            good=max(hard+1,math.ceil(schedule['interval']*schedule['ease']))
            easy=max(good+1,math.ceil(schedule['interval']*schedule['ease']*1.3))
            s['interval']=min(36500,{2:hard,3:good,4:easy}[rating]);s['ease']=min(3.5,max(1.3,s['ease']+{2:-.15,3:0,4:.15}[rating]));delay=s['interval']*day
    s['due']=int(at+delay);return s

def review_card(old,rating,at,mode='recognition'):
    if old.get('learningMode','learning')=='reference':
        raise HTTPException(409,'Move this reference card to Learning before reviewing.')
    skills=dict(old.get('skills',{}))
    base=old['schedule'] if mode=='recognition' else skills.get(mode,Schedule(due=at).model_dump())
    if base.get('lastReview') is not None and at < base['lastReview']:
        raise HTTPException(409,'An older review cannot replace a newer review. Resolve this conflict first.')
    updated=schedule_review(base,rating,at);skills[mode]=updated
    return {**old,'skills':skills,'schedule':updated if mode=='recognition' else old['schedule']}

def install_social(app,connection,authenticated,rate,clear_private_cache=None):
    def unavailable(): raise HTTPException(404,'Not found or no longer shared with you.')
    def blocked(conn,a,b):
        return conn.execute('SELECT 1 FROM blocks WHERE (owner_id=? AND blocked_id=?) OR (owner_id=? AND blocked_id=?)',(a,b,b,a)).fetchone() is not None
    def friends(conn,a,b):
        low,high=sorted([a,b])
        return not blocked(conn,a,b) and conn.execute("SELECT 1 FROM friendships WHERE low_id=? AND high_id=? AND status='accepted'",(low,high)).fetchone() is not None
    def get_card(conn,uid,cid):
        row=conn.execute('SELECT body FROM cloud_cards WHERE owner_id=? AND id=?',(uid,str(cid))).fetchone()
        if not row: raise HTTPException(404,'This card was not found in your library.')
        return json.loads(row['body'])
    def existing(conn,uid,card):
        row=conn.execute('SELECT body FROM cloud_cards WHERE owner_id=? AND (identity=? OR id=?)',(uid,identity(card),card['id'])).fetchone()
        if not row and card.get('conceptId'):
            plain={**card,'conceptId':''}
            row=conn.execute('SELECT body FROM cloud_cards WHERE owner_id=? AND identity=?',(uid,identity(plain))).fetchone()
        if not row and not card.get('conceptId'):
            # Manual/shared cards must not duplicate an existing graph-linked card.
            for candidate in conn.execute('SELECT body FROM cloud_cards WHERE owner_id=?', (uid,)):
                parsed = json.loads(candidate['body'])
                if identity({**parsed, 'conceptId': ''}) == identity(card):
                    return parsed
        return json.loads(row['body']) if row else None
    def save(conn,uid,card,old=None):
        key=identity(card)
        duplicate=conn.execute('SELECT id FROM cloud_cards WHERE owner_id=? AND identity=?',(uid,key)).fetchone()
        if duplicate and duplicate['id']!=card['id']: raise HTTPException(409,'This word and meaning already exist in your library.')
        if old:
            card={**card,'revision':old['revision']+1,'updatedAt':now()}
            conn.execute('UPDATE cloud_cards SET identity=?,body=?,revision=? WHERE owner_id=? AND id=?',(key,dump(card),card['revision'],uid,card['id']))
        else:
            if conn.execute('SELECT count(*) FROM cloud_cards WHERE owner_id=?',(uid,)).fetchone()[0]>=5000: raise HTTPException(409,'Your beta library has reached 5,000 cards. Export a backup and contact the server owner.')
            conn.execute('INSERT INTO cloud_cards VALUES(?,?,?,?,?)',(uid,card['id'],key,dump(card),card['revision']))
        return card
    def expect_revision(card,revision):
        if card['revision']!=revision: raise HTTPException(409,'This card changed on another device. Refresh before editing or reviewing it.')
    def public_card(card):
        return {k:card[k] for k in ('front','back','sourceLang','targetLang','context','conceptId','literal','usage','example','reply','provenance','reviewStatus') if k in card}
    def share_cards(conn,uid,ids):
        return [public_card(get_card(conn,uid,cid)) for cid in dict.fromkeys(map(str,ids))]
    def accessible(conn,uid,lid):
        row=conn.execute('SELECT l.*,u.handle owner FROM shared_libraries l JOIN users u ON u.id=l.owner_id WHERE l.id=?',(str(lid),)).fetchone()
        if not row: unavailable()
        if row['owner_id']!=uid:
            if not friends(conn,uid,row['owner_id']) or not conn.execute('SELECT 1 FROM library_members WHERE library_id=? AND user_id=?',(str(lid),uid)).fetchone(): unavailable()
        return row
    def library_output(conn,row,uid,detail=False):
        cards=json.loads(row['cards_json'])
        value={'id':row['id'],'title':row['title'],'description':row['description'],'owner':row['owner'], 'owned':row['owner_id']==uid,'count':len(cards),'revision':row['revision'],'createdAt':row['created_at'],'updatedAt':row['updated_at']}
        if value['owned']:
            value['recipients']=[r['handle'] for r in conn.execute('SELECT u.handle FROM library_members m JOIN users u ON u.id=m.user_id WHERE m.library_id=? ORDER BY u.handle',(row['id'],))]
        if detail: value['cards']=cards
        return value

    @app.get('/api/library')
    def library(user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            return {'cards':[json.loads(r[0]) for r in conn.execute('SELECT body FROM cloud_cards WHERE owner_id=? ORDER BY id',(uid,))],
                    'logs':[json.loads(r[0]) for r in conn.execute('SELECT body FROM cloud_logs WHERE owner_id=? ORDER BY at DESC LIMIT 10000',(uid,))],
                    'history':[json.loads(r[0]) for r in conn.execute('SELECT body FROM cloud_history WHERE owner_id=? ORDER BY at DESC LIMIT 50',(uid,))]}

    @app.post('/api/library/cards')
    def add(data:Add,user=Depends(authenticated)):
        uid=user['user_id'];rate('library-write',uid,1000,3600)
        added=0;cards=[]
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            for model in data.cards:
                card=model.model_dump(mode='json');old=existing(conn,uid,card)
                if old: cards.append(old)
                else: cards.append(save(conn,uid,card));added+=1
            conn.commit()
        return {'cards':cards,'added':added,'duplicates':len(cards)-added}

    @app.post('/api/library/translations')
    def commit(data:Commit,user=Depends(authenticated)):
        uid=user['user_id'];rate('library-write',uid,1000,3600)
        card=data.card.model_dump(mode='json');restored=False
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');old=existing(conn,uid,card)
            if old:
                restored=old['archived']
                if restored or (card.get('conceptId') and not old.get('conceptId')):
                    card=save(conn,uid,{**old,'archived':False,'conceptId':card.get('conceptId') or old.get('conceptId','')},old)
                else: card=old
            else: card=save(conn,uid,card)
            entry={**public_card(card),'id':identity(card),'provider':data.provider,'at':now()}
            conn.execute('INSERT OR REPLACE INTO cloud_history VALUES(?,?,?,?)',(uid,entry['id'],dump(entry),entry['at']))
            conn.execute('DELETE FROM cloud_history WHERE owner_id=? AND identity NOT IN(SELECT identity FROM cloud_history WHERE owner_id=? ORDER BY at DESC LIMIT 50)',(uid,uid))
            conn.commit()
        return {'card':card,'added':old is None,'restored':restored}

    @app.patch('/api/library/cards/{cid}')
    def edit(cid:uuid.UUID,data:Edit,user=Depends(authenticated)):
        uid=user['user_id'];rate('library-write',uid,1000,3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');old=get_card(conn,uid,cid);expect_revision(old,data.revision)
            card=save(conn,uid,{**old,**data.content.model_dump()},old);conn.commit();return card

    @app.post('/api/library/cards/{cid}/archive')
    def archive(cid:uuid.UUID,data:Archive,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');old=get_card(conn,uid,cid);expect_revision(old,data.revision)
            card=save(conn,uid,{**old,'archived':data.archived},old);conn.commit();return card

    @app.post('/api/library/cards/{cid}/review')
    def grade(cid:uuid.UUID,data:Grade,user=Depends(authenticated)):
        uid=user['user_id'];rate('library-review',uid,1000,3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');old=get_card(conn,uid,cid);expect_revision(old,data.revision)
            if old['archived']: raise HTTPException(409,'This card is archived.')
            at=now();card=save(conn,uid,review_card(old,data.rating,at,data.practiceMode),old)
            log={'id':str(uuid.uuid4()),'cardId':old['id'],'at':at,'rating':data.rating,'before':old,'afterRevision':card['revision'],'durationMs':data.durationMs,'practiceMode':data.practiceMode}
            conn.execute('INSERT INTO cloud_logs VALUES(?,?,?,?,?)',(uid,log['id'],old['id'],dump(log),at))
            conn.commit();return {'card':card,'log':log}

    @app.post('/api/library/reviews/{lid}/undo')
    def undo(lid:uuid.UUID,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row=conn.execute('SELECT body FROM cloud_logs WHERE owner_id=? AND id=?',(uid,str(lid))).fetchone()
            if not row: raise HTTPException(404,'This review can no longer be undone.')
            log=json.loads(row[0]);old=get_card(conn,uid,log['cardId']);expect_revision(old,log['afterRevision'])
            save(conn,uid,log['before'],old)
            conn.execute('DELETE FROM cloud_logs WHERE owner_id=? AND id=?',(uid,str(lid)));conn.commit();return {'ok':True}

    @app.delete('/api/library/history')
    def clear_history(user=Depends(authenticated)):
        with connection() as conn: conn.execute('DELETE FROM cloud_history WHERE owner_id=?',(user['user_id'],))
        if clear_private_cache:
            clear_private_cache(user['user_id'])
        return {'ok':True}

    @app.delete('/api/library')
    def clear_library(user=Depends(authenticated)):
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            conn.execute('DELETE FROM cloud_cards WHERE owner_id=?',(user['user_id'],))
            conn.execute('DELETE FROM cloud_history WHERE owner_id=?',(user['user_id'],))
            # Keep idempotency tombstones, but remove previously returned private
            # card content. Retried old operations must not resurrect a cleared library.
            if conn.execute("SELECT 1 FROM sqlite_master WHERE name='sync_receipts'").fetchone():
                conn.execute('UPDATE sync_receipts SET result=? WHERE owner_id=?',(dump({'ok':True,'cleared':True}),user['user_id']))
            conn.commit()
        return {'ok':True}

    @app.get('/api/friends')
    def list_friends(user=Depends(authenticated)):
        uid=user['user_id'];result={'friends':[],'incoming':[],'outgoing':[]}
        with connection() as conn:
            rows=conn.execute('SELECT f.*,a.handle requester,b.handle recipient FROM friendships f JOIN users a ON a.id=f.requester_id JOIN users b ON b.id=f.recipient_id WHERE f.requester_id=? OR f.recipient_id=? ORDER BY f.created_at DESC',(uid,uid))
            for row in rows:
                other=row['recipient_id'] if row['requester_id']==uid else row['requester_id']
                if blocked(conn,uid,other): continue
                group='friends' if row['status']=='accepted' else 'outgoing' if row['requester_id']==uid else 'incoming'
                result[group].append({'id':row['id'],'handle':row['recipient'] if row['requester_id']==uid else row['requester'],'createdAt':row['created_at']})
        return result

    @app.post('/api/friends',status_code=201)
    def add_friend(data:Friend,user=Depends(authenticated)):
        uid=user['user_id'];rate('friend-request',uid,30,3600)
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');target=conn.execute('SELECT id FROM users WHERE handle=?',(data.handle.lower(),)).fetchone()
            if not target or blocked(conn,uid,target['id']): unavailable()
            if target['id']==uid: raise HTTPException(400,'Enter someone else\'s handle.')
            low,high=sorted([uid,target['id']]);old=conn.execute('SELECT id,status FROM friendships WHERE low_id=? AND high_id=?',(low,high)).fetchone()
            if old: return {'id':old['id'],'status':old['status'],'duplicate':True}
            if conn.execute("SELECT count(*) FROM friendships WHERE recipient_id=? AND status='pending'",(target['id'],)).fetchone()[0]>=200: raise HTTPException(429,'This account has too many pending invitations.')
            fid=str(uuid.uuid4());conn.execute('INSERT INTO friendships VALUES(?,?,?,?,?,?,?)',(fid,uid,target['id'],low,high,'pending',now()));conn.commit()
        return {'id':fid,'status':'pending','duplicate':False}

    @app.patch('/api/friends/{fid}')
    def decide_friend(fid:uuid.UUID,data:Decision,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=conn.execute('SELECT * FROM friendships WHERE id=? AND recipient_id=?',(str(fid),uid)).fetchone()
            if not row or blocked(conn,uid,row['requester_id']): unavailable()
            if data.status=='accepted': conn.execute("UPDATE friendships SET status='accepted' WHERE id=?",(str(fid),))
            else: conn.execute('DELETE FROM friendships WHERE id=?',(str(fid),))
            conn.commit()
        return {'ok':True}

    @app.delete('/api/friends/{fid}')
    def remove_friend(fid:uuid.UUID,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row=conn.execute('SELECT * FROM friendships WHERE id=? AND (requester_id=? OR recipient_id=?)',(str(fid),uid,uid)).fetchone()
            if not row: unavailable()
            # Remove grants as well, so re-adding a friend cannot restore old sharing without consent.
            other=row['recipient_id'] if row['requester_id']==uid else row['requester_id']
            conn.execute('DELETE FROM library_members WHERE (user_id=? AND library_id IN(SELECT id FROM shared_libraries WHERE owner_id=?)) OR (user_id=? AND library_id IN(SELECT id FROM shared_libraries WHERE owner_id=?))',(uid,other,other,uid))
            conn.execute('DELETE FROM friendships WHERE id=?',(str(fid),));conn.commit()
        return {'ok':True}

    @app.get('/api/shared-libraries')
    def list_libraries(user=Depends(authenticated)):
        uid=user['user_id'];result=[]
        with connection() as conn:
            rows=conn.execute('SELECT DISTINCT l.*,u.handle owner FROM shared_libraries l JOIN users u ON u.id=l.owner_id LEFT JOIN library_members m ON m.library_id=l.id WHERE l.owner_id=? OR m.user_id=? ORDER BY l.updated_at DESC LIMIT 200',(uid,uid))
            for row in rows:
                if row['owner_id']==uid or friends(conn,uid,row['owner_id']): result.append(library_output(conn,row,uid))
        return {'libraries':result}

    @app.post('/api/shared-libraries',status_code=201)
    def publish(data:Publish,user=Depends(authenticated)):
        uid=user['user_id'];rate('library-share',uid,30,3600)
        if not data.title: raise HTTPException(422,'Give the collection a title.')
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            if conn.execute('SELECT count(*) FROM shared_libraries WHERE owner_id=?',(uid,)).fetchone()[0]>=100: raise HTTPException(409,'You can share at most 100 collections in this beta.')
            recipients=[]
            for handle in data.recipients:
                target=conn.execute('SELECT id FROM users WHERE handle=?',(handle,)).fetchone()
                if not target or not friends(conn,uid,target['id']): raise HTTPException(403,'Collections can only be shared with accepted friends.')
                recipients.append(target['id'])
            cards=share_cards(conn,uid,data.cardIds);lid=str(uuid.uuid4());at=now()
            conn.execute('INSERT INTO shared_libraries VALUES(?,?,?,?,?,?,?,?)',(lid,uid,data.title,data.description,dump(cards),1,at,at))
            for rid in recipients: conn.execute('INSERT INTO library_members VALUES(?,?)',(lid,rid))
            conn.commit();return {'id':lid,'revision':1,'count':len(cards)}

    @app.get('/api/shared-libraries/{lid}')
    def preview(lid:uuid.UUID,user=Depends(authenticated)):
        with connection() as conn: return library_output(conn,accessible(conn,user['user_id'],lid),user['user_id'],True)

    @app.patch('/api/shared-libraries/{lid}')
    def refresh(lid:uuid.UUID,data:Refresh,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=accessible(conn,uid,lid)
            if row['owner_id']!=uid: raise HTTPException(403,'Only the owner can update this shared snapshot.')
            if row['revision']!=data.revision: raise HTTPException(409,'The collection changed. Reopen it before publishing an update.')
            cards=share_cards(conn,uid,data.cardIds)
            conn.execute('UPDATE shared_libraries SET cards_json=?,revision=revision+1,updated_at=? WHERE id=?',(dump(cards),now(),str(lid)));conn.commit()
        return {'ok':True,'revision':data.revision+1}

    @app.delete('/api/shared-libraries/{lid}')
    def revoke(lid:uuid.UUID,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=accessible(conn,uid,lid)
            if row['owner_id']==uid: conn.execute('DELETE FROM shared_libraries WHERE id=?',(str(lid),))
            else: conn.execute('DELETE FROM library_members WHERE library_id=? AND user_id=?',(str(lid),uid))
            conn.commit()
        return {'ok':True}

    @app.delete('/api/shared-libraries/{lid}/members/{handle}')
    def revoke_member(lid:uuid.UUID,handle:str,user=Depends(authenticated)):
        uid=user['user_id']
        with connection() as conn:
            conn.execute('BEGIN IMMEDIATE');row=accessible(conn,uid,lid)
            if row['owner_id']!=uid: raise HTTPException(403,'Only the owner can remove recipients.')
            conn.execute('DELETE FROM library_members WHERE library_id=? AND user_id IN(SELECT id FROM users WHERE handle=?)',(str(lid),handle.lower()));conn.commit()
        return {'ok':True}

    return dict(get_card=get_card,existing=existing,save=save,expect_revision=expect_revision,
                public_card=public_card,share_cards=share_cards,accessible=accessible,
                friends=friends,blocked=blocked,library_output=library_output)
