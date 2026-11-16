"""Consistent SQLite snapshots, optional encrypted off-server upload, safe restore.
One instance only. Backups remain disabled unless NABU_BACKUP_ENABLED=true.
Never restores over an existing file; never logs secrets or user data.
"""
from __future__ import annotations
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import uuid
from tools.backup_database import backup

log=logging.getLogger('nabu.backup')

def validate_database(path:Path):
    path=path.resolve()
    with sqlite3.connect(path.as_uri()+'?mode=ro',uri=True) as conn:
        if conn.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Database integrity check failed.')
        if conn.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Database has broken foreign keys.')
        version=conn.execute('PRAGMA user_version').fetchone()[0]
        if version not in (1,2,3,4):raise ValueError('Unsupported backup version.')
        if version==4:conn.execute('SELECT slug,owner_id,expires_at FROM word_links LIMIT 1')
        for table in ('users','sessions'):conn.execute('SELECT 1 FROM '+table+' LIMIT 1')


def encrypt_snapshot(source:Path,target:Path,key:str):
    from cryptography.fernet import Fernet
    f=Fernet(key.encode())
    if source.stat().st_size>64*1024*1024:raise ValueError('Snapshot exceeds the 64 MB encrypted-backup pilot limit. Use a streaming backup solution.')
    token=f.encrypt(source.read_bytes())
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as out:out.write(token)
    return target


def restore(source:Path,target:Path,key:str=''):
    """Decrypt/validate into a NEW path and revoke old sessions. Stop the app before swapping files."""
    source=source.resolve();target=target.resolve()
    if target.exists():raise FileExistsError('Refusing to overwrite an existing database.')
    payload=source.read_bytes()
    if key:
        from cryptography.fernet import Fernet
        payload=Fernet(key.encode()).decrypt(payload)
    target.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    try:
        with os.fdopen(fd,'wb') as out:out.write(payload)
        validate_database(target)
        with sqlite3.connect(target) as conn:
            conn.execute('DELETE FROM sessions')
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='word_links'").fetchone():
                # Restoring an older snapshot must not resurrect a revoked public link.
                conn.execute('UPDATE word_links SET revoked_at=COALESCE(revoked_at,?)',(int(time.time()),))
            conn.commit()
        return target
    except Exception:
        target.unlink(missing_ok=True);raise


def run_backup(database:Path,directory:Path,bucket='',key='',client=None,keep=7,prefix='nabu/'):
    database=database.resolve();directory=directory.resolve()
    directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    name=time.strftime('nabu-%Y%m%dT%H%M%SZ-',time.gmtime())+uuid.uuid4().hex[:8]
    target=directory/(name+'.sqlite3')
    backup(database,target);validate_database(target)
    uploaded=False;encrypted=None;remote_key=None;cipher_digest=None
    if bucket:
        if not key:raise ValueError('Off-server backups require NABU_BACKUP_KEY; no plaintext is uploaded.')
        encrypted=encrypt_snapshot(target,directory/(name+'.sqlite3.fernet'),key)
        if client is None:
            import boto3
            from botocore.config import Config
            endpoint=os.environ.get('NABU_BACKUP_ENDPOINT') or None
            if endpoint and not endpoint.startswith('https://'):raise ValueError('Backup storage requires an HTTPS endpoint.')
            client=boto3.client('s3',endpoint_url=endpoint,region_name=os.environ.get('AWS_DEFAULT_REGION','us-east-1'),
                               config=Config(connect_timeout=10,read_timeout=30,retries={'max_attempts':3}))
        remote_key=prefix+encrypted.name
        cipher_digest=hashlib.sha256(encrypted.read_bytes()).hexdigest()
        client.upload_file(str(encrypted),bucket,remote_key,ExtraArgs={
            'ContentType':'application/octet-stream','Metadata':{'sha256':cipher_digest}})
        # A HEAD response only checks upload metadata; an independent download and
        # SQLite restore drill is still required for verified disaster recovery.
        meta=client.head_object(Bucket=bucket,Key=remote_key)
        if meta['ContentLength']!=encrypted.stat().st_size:raise RuntimeError('Remote backup size did not match.')
        if meta.get('Metadata',{}).get('sha256')!=cipher_digest:raise RuntimeError('Remote backup digest metadata did not match.')
        uploaded=True
    report={'lastSuccess':int(time.time()),'offsite':uploaded,'file':target.name}
    if uploaded:report.update(remoteKey=remote_key,cipherSHA256=cipher_digest)
    report_path=directory/'status.json';temp=directory/'status.json.tmp'
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as out:json.dump(report,out)
    os.replace(temp,report_path)
    # Only rotate after a complete, verified run. Offsite retention is a bucket lifecycle rule.
    for pattern in ('nabu-*.sqlite3','nabu-*.fernet'):
        for path in sorted(directory.glob(pattern),key=lambda x:x.stat().st_mtime,reverse=True)[max(1,keep):]:path.unlink()
    return report


def start_worker(database:Path):
    stop=threading.Event()
    if os.environ.get('NABU_BACKUP_ENABLED')!='true':return stop,None
    directory=Path(os.environ.get('NABU_BACKUP_DIR',database.parent/'backups'))
    interval=max(300,int(os.environ.get('NABU_BACKUP_INTERVAL_SECONDS','21600')))
    def work():
        while not stop.is_set():
            try:
                run_backup(database,directory,os.environ.get('NABU_BACKUP_BUCKET',''),os.environ.get('NABU_BACKUP_KEY',''))
                log.info('Nabu backup completed. Offsite=%s',bool(os.environ.get('NABU_BACKUP_BUCKET')))
            except Exception as error:
                # Log the exception class only: SDK messages can contain infrastructure identifiers.
                log.error('Nabu backup failed (%s). Check backup status and credentials.',type(error).__name__)
            stop.wait(interval)
    thread=threading.Thread(target=work,name='nabu-backup',daemon=True);thread.start();return stop,thread
