## SAMS Club
Schedule: *every wednesday night*

This club data will contain base information for every team including team -name, -ID, -league. 
We need the team IDs to make specific requests for match and ranking data.
This club data doesn't change often. Hence its relaxed schedule. 
  
## SAMS Ranking
Schedule: *every night & every hour over the weekend*

For each team's league, we are making a call to the SAMS server to retrive the current rankings for that league.
This data servers to display rankings on the home page. https://vcmuellheim.de/tabelle/

## SAMS Match
Schedule: *every night & every hour over the weekend*

For each team, we are making a call to the SAMS server to retrive past and future matches for each team.
This data serves as game results and upcoming event schedule on the home page. e.g. https://vcmuellheim.de/matches/18452008

Every new match that has a score attached will be cached as file in this repo. This serves as a history and new entries can there trigger other actions, such as announcing the new score on social.

SAMS already hosts an ical that users can download. However, to also cache this data and consistently serve users from the same first party domain, we cache the ical as part of this workflow.

## Social Matches
Trigger: *on every new match file commited*

Whenever a new match is commited, we check the git log for every file and check if it contains a keyword aka "social". If we git log does not contain the keyword, we fetch the data and announce the match score on Mastodon, then make a fake commit containing the keyword. This way matches get 'flagged‘ and skipped during future workflow runs. 

## Social Posts
Trigger: *on every new blog post commit*

Similar to announcing matches, we check every post git log for a keyword "social". If any file history does not contain the keyword, the blog post is shared on social (Mastodon & Twitter), then flagged via fake commit to populate the git log history.