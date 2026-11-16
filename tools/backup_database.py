"""Consistent SQLite backup, including committed WAL data; never copies a live file raw.
Example: python tools/backup_database.py --db /var/data/nabu.sqlite3 --out /var/data/backups/nabu.sqlite3
Copy the result to private off-host storage. A backup on the same disk is not disaster recovery.
"""
from __future__ import annotations
import argparse, os, sqlite3
from pathlib import Path

def backup(database:Path,output:Path):
    database=database.resolve();output=output.resolve()
    if not database.is_file(): raise FileNotFoundError(database)
    if output.exists(): raise FileExistsError('Choose a new backup filename; existing backups are not overwritten.')
    output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.close(fd)
    try:
        with sqlite3.connect(database.as_uri()+'?mode=ro',uri=True) as source,sqlite3.connect(output) as target:
            source.backup(target)
            result=target.execute('PRAGMA integrity_check').fetchone()[0]
            if result!='ok': raise RuntimeError('Backup integrity check failed: '+result)
        return output
    except Exception:
        output.unlink(missing_ok=True);raise

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',required=True,type=Path);parser.add_argument('--out',required=True,type=Path)
    args=parser.parse_args();print(backup(args.db,args.out))
