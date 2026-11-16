"""Download the latest encrypted offsite backup and restore it in private temporary
storage. Never touches a live DB, prints private records, or changes backup status.

Run periodically from a trusted operator shell with S3 credentials and NABU_BACKUP_KEY.
A successful HEAD request alone does NOT constitute a verified restore.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backup_service import restore


def verify_offsite(directory:Path,bucket:str,key:str,client=None):
    directory=directory.resolve()
    if not bucket or not key:raise ValueError('Both the private bucket and encryption key are required.')
    status=json.loads((directory/'status.json').read_text())
    remote_key=status.get('remoteKey')
    expected=status.get('cipherSHA256')
    if not status.get('offsite') or not isinstance(remote_key,str) or not remote_key.endswith('.sqlite3.fernet') or not re.fullmatch('[0-9a-f]{64}',str(expected)):
        raise ValueError('No eligible encrypted offsite snapshot in backup status.')
    if client is None:
        import boto3
        from botocore.config import Config
        endpoint=os.environ.get('NABU_BACKUP_ENDPOINT') or None
        if endpoint and not endpoint.startswith('https://'):
            raise ValueError('Backup storage requires an HTTPS endpoint.')
        client=boto3.client('s3',endpoint_url=endpoint,region_name=os.environ.get('AWS_DEFAULT_REGION','us-east-1'),
                           config=Config(connect_timeout=10,read_timeout=30,retries={'max_attempts':3}))
    # A different source volume and an isolated host are preferable for the
    # production drill. This local scratch path is created with 0700 permissions.
    with tempfile.TemporaryDirectory(prefix='nabu-restore-drill-') as folder:
        tmp=Path(folder);encrypted=tmp/'remote.fernet';restored=tmp/'verified.sqlite3'
        client.download_file(bucket,remote_key,str(encrypted))
        if hashlib.sha256(encrypted.read_bytes()).hexdigest()!=expected:
            raise ValueError('Downloaded snapshot digest mismatch; do not trust this backup.')
        restore(encrypted,restored,key)
        with sqlite3.connect(restored) as conn:
            # restored sessions must be revoked; this test deliberately exercises
            # decryption, SQLite integrity, foreign keys and safe restore behavior.
            if conn.execute('SELECT count(*) FROM sessions').fetchone()[0]!=0:
                raise RuntimeError('Restored sessions were not revoked.')
            users=conn.execute('SELECT count(*) FROM users').fetchone()[0]
            cards=conn.execute('SELECT count(*) FROM cloud_cards').fetchone()[0]
    return {'ok':True,'checkedAt':int(time.time()),'snapshot':remote_key.rsplit('/',1)[-1],
            'sha256':expected,'users':users,'cards':cards}


def write_receipt(directory:Path,report:dict):
    directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    target=directory/'restore-drill.json';tmp=directory/'restore-drill.json.tmp'
    fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as stream:json.dump(report,stream)
    os.replace(tmp,target)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--directory',type=Path,default=Path(os.environ.get('NABU_BACKUP_DIR',Path(os.environ.get('NABU_DB','.data/nabu.sqlite3')).parent/'backups')))
    args=p.parse_args()
    try:
        report=verify_offsite(args.directory,os.environ.get('NABU_BACKUP_BUCKET',''),os.environ.get('NABU_BACKUP_KEY',''))
        write_receipt(args.directory,report)
        print(json.dumps({'ok':True,'restoredFromOffsite':True,'checkedAt':report['checkedAt']}))
        return 0
    except Exception as exc:
        # Do not echo SDK exception messages containing bucket names or endpoints.
        failure={'ok':False,'checkedAt':int(time.time()),'errorType':type(exc).__name__}
        # An earlier successful drill must not hide the newest failed attempt.
        try:write_receipt(args.directory,failure)
        except OSError:failure['receiptWriteFailed']=True
        print(json.dumps(failure),file=sys.stderr)
        return 1
if __name__=='__main__':sys.exit(main())
