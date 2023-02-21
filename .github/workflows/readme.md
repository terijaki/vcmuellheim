## SAMS Data Synchronisation
Schedule: *Every 15 minutes, between 11 AM and 11 PM, Saturday-Monday*
Schedule: *Every day at 04:04 AM*

This workflow fetches the latest information of our club and teams from the SAMS Datebase. This includes lague rankings, match schedule and match results.
The purpose of this workflow is to cache the files on our end. 
  
## Rankings & Matches
Trigger: *any added or modified file from SAMS Data Synchronisation*

If the commit contains a ranking xml file, we process the file to produce a html file which is then displayed at https://vcmuellheim.de/tabelle/ with the next build.

If the commit contains a matching xml file, we process the file to list upcoming matches and match scores on a team page such as https://vcmuellheim.de/matches/22517240.
The page may not contain any schedule or results if the season has not started or ended already.

Every new match that has a score attached will be cached as file in this repo. This serves as a history and to trigger other actions, such as announcing the new score on social.

The SAMS server already hosts an ical that users can download. However, to cache this data and consistently serve users from the same first party domain, we cache the ical as part of this workflow. In the process we inject some data such as our club's name and team.

## Social Matches
Trigger: *on every match file commit*

Whenever a new match is commited, we check the git log for every file and check if it contains a keyword aka "social". If we git log does not contain the keyword, we fetch the data and announce the match score on Mastodon, then make a fake commit containing the keyword. This way matches get 'flagged‘ and skipped during future workflow runs. 

## Social Posts
Trigger: *on every blog post commit*

Similar to announcing matches, we check every post git log for a keyword "social". If any file history does not contain the keyword, the blog post is shared on social (Mastodon & Twitter), then flagged via fake commit to populate the git log history.