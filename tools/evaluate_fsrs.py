"""Optional, non-mutating FSRS replay of an exported Nabu library.
Install optional dependency: python -m pip install fsrs==6.3.0
Usage: python tools/evaluate_fsrs.py backup.json --output fsrs-evaluation.json
This never writes a Nabu database or changes schedules. Run with real delayed
review data before considering migration; self-ratings are not efficacy evidence.
"""
from __future__ import annotations
import argparse,json,math,sys
from pathlib import Path
from datetime import datetime,timezone

def load_reviews(path):
 data=json.loads(Path(path).read_text())
 if data.get('app')!='nabu' or not isinstance(data.get('logs'),list):raise ValueError('Use a Nabu JSON backup with review logs.')
 reviews=[]
 for raw in data['logs']:
  try:
   if raw['rating'] not in (1,2,3,4) or isinstance(raw['rating'],bool):raise ValueError()
   mode=raw.get('practiceMode','recognition')
   if mode not in ('recognition','production','listening','cloze'):raise ValueError()
   at=datetime.fromtimestamp(raw['at']/1000,tz=timezone.utc)
   if not isinstance(raw['cardId'],str):raise ValueError()
   reviews.append({'cardId':raw['cardId'],'mode':mode,'at':at,'rating':raw['rating']})
  except (KeyError,ValueError,TypeError,OverflowError):raise ValueError('Backup contains an invalid review record.')
 return sorted(reviews,key=lambda x:x['at'])

def evaluate(reviews,retention=.9):
 try:from fsrs import Scheduler,Card,Rating
 except ImportError as exc:raise RuntimeError('Optional fsrs dependency is missing. Install fsrs==6.3.0 in an isolated analysis environment.') from exc
 scheduler=Scheduler(desired_retention=retention,enable_fuzzing=False)
 cards={};last={};scores=[];duplicate_times=0
 for event in reviews:
  key=(event['cardId'],event['mode']);when=event['at'];card=cards.get(key)
  if key in last and when<=last[key]:duplicate_times+=1;continue
  if card and (when-last[key]).total_seconds()>=86400:
   probability=scheduler.get_card_retrievability(card,when)
   y=int(event['rating']>1);p=min(1-1e-9,max(1e-9,probability))
   scores.append({'mode':event['mode'],'brier':(p-y)**2,'logLoss':-(y*math.log(p)+(1-y)*math.log(1-p))})
  if card is None:card=Card(due=when)
  updated,_=scheduler.review_card(card,Rating(event['rating']),review_datetime=when)
  cards[key]=updated;last[key]=when
 by_mode={}
 for mode in ('recognition','production','listening','cloze'):
  rows=[s for s in scores if s['mode']==mode]
  by_mode[mode]={'delayedObservations':len(rows),'meanBrier':sum(s['brier'] for s in rows)/len(rows) if rows else None,'meanLogLoss':sum(s['logLoss'] for s in rows)/len(rows) if rows else None}
 return {'readOnly':True,'model':'fsrs default parameters; not fitted','desiredRetention':retention,'reviews':len(reviews),'discardedNonIncreasingTimes':duplicate_times,'skills':len(cards),'delayedObservations':len(scores),'metrics':by_mode,'cautions':['Exploratory replay of self-ratings, not a randomized comparison.','Imported schedules without preceding review history cannot initialize a reliable replay.','No parameter optimization, production migration, or efficacy claim.'],'candidateSchedules':[{'cardId':key[0],'mode':key[1],'fsrs':card.to_dict()} for key,card in cards.items()]}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('backup',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--retention',type=float,default=.9);a=p.parse_args()
 if not .7<=a.retention<=.99:p.error('Retention must be between 0.70 and 0.99.')
 if a.output.exists():p.error('Choose a new output path; existing files are never overwritten.')
 try:
  result=evaluate(load_reviews(a.backup),a.retention)
  # Detailed schedules identify cards: output is private, not an analytics upload.
  import os
  with os.fdopen(os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as f:json.dump(result,f,indent=2)
 except (OSError,ValueError,RuntimeError) as exc:print(str(exc),file=sys.stderr);return 1
 print(f'Read-only evaluation saved to {a.output}. Production schedules were not changed.');return 0
if __name__=='__main__':sys.exit(main())
