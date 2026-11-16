"""Operator-only backup health check. Exit nonzero if stale or not off-server.
Run on the server or a monitoring agent; never exposes backup paths in a public API.
"""
from pathlib import Path
import argparse,json,os,sys,time,math

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--directory',type=Path,default=Path(os.environ.get('NABU_BACKUP_DIR',Path(os.environ.get('NABU_DB','.data/nabu.sqlite3')).parent/'backups')))
 parser.add_argument('--max-age-hours',type=float,default=13)
 parser.add_argument('--require-offsite',action='store_true')
 parser.add_argument('--require-restore-drill',action='store_true')
 parser.add_argument('--max-restore-age-hours',type=float,default=168)
 args=parser.parse_args()
 try:
  if not all(math.isfinite(v) and v>0 for v in (args.max_age_hours,args.max_restore_age_hours)):raise ValueError('Use positive finite age limits.')
  status=json.loads((args.directory/'status.json').read_text())
  if not isinstance(status,dict) or type(status.get('lastSuccess')) not in (int,float) or not math.isfinite(status['lastSuccess']):raise ValueError('Invalid backup receipt.')
  age=time.time()-status['lastSuccess']
  if age<0 or age>args.max_age_hours*3600:raise ValueError('No recent successful backup.')
  if args.require_offsite and status.get('offsite') is not True:raise ValueError('No confirmed off-server backup.')
  if args.require_restore_drill:
   drill=json.loads((args.directory/'restore-drill.json').read_text())
   if not isinstance(drill,dict) or type(drill.get('checkedAt')) not in (int,float) or not math.isfinite(drill['checkedAt']):raise ValueError('Invalid restore receipt.')
   drill_age=time.time()-drill['checkedAt']
   if drill.get('ok') is not True or drill_age<0 or drill_age>args.max_restore_age_hours*3600 or status.get('offsite') is not True:
    raise ValueError('No recent successful offsite restore drill.')
  print(json.dumps({'ok':True,'ageMinutes':round(age/60,1),'offsite':bool(status.get('offsite')),
                    'restoreDrillChecked':bool(args.require_restore_drill)}));return 0
 except (OSError,ValueError,KeyError,TypeError):
  print(json.dumps({'ok':False,'message':'Backup status is missing, stale, or does not meet the offsite requirement.'}));return 1
if __name__=='__main__':sys.exit(main())
