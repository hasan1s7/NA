"""Restore a backup to a new path, verify it, and invalidate old sessions.
Stop Nabu before replacing production files. Never pass the key on a command line.
"""
import argparse,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backup_service import restore
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--backup',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
    p.add_argument('--encrypted',action='store_true');a=p.parse_args()
    key=os.environ.get('NABU_BACKUP_KEY','') if a.encrypted else ''
    if a.encrypted and not key:p.error('Set NABU_BACKUP_KEY privately in the environment.')
    print(restore(a.backup,a.out,key))
