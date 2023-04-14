---
permalink: /test.ics
sbvv_id:
---

BEGIN:VCALENDAR
X-WR-CALNAME:{{ site.name }}
PRODID:-//{{ site.official_name }}//Website//DE
VERSION:2.0
CALSCALE:GREGORIAN
{%- for schedule_json in site.data.sams.matches -%}
    {%- assign stripped_results = results_json[1] | strip -%}
    {%- if include.team == nil or stripped_results contains include.team -%}
        {% for match in schedule_json[1].matches.match -%}
            {%- assign schedule_matches_lastupdated = schedule_matches_lastupdated | append: match.matchSeries.updated | append: "#" -%}
            {% if match.matchSeries.type %}
BEGIN:VEVENT
UID:{{ match.matchSeries.uuid }}
SUMMARY:{{ match.team[0].name }} vs. {{ match.team[1].name }}\, {{ match.matchSeries.name }}
TZID:{{ site.timezone }}
CREATED:{{ match.matchSeries.structureUpdated | date: "%Y%m%dT%H%M%S%z" }}
LAST-MODIFIED:{{ match.matchSeries.updated | date: "%Y%m%dT%H%M%S%z" }}
DTSTAMP:{{ match.matchSeries.updated | date: "%Y%m%dT%H%M%S%z" }}
DTSTART;TZID={{ site.timezone }}:{{ match.date | date: "%Y%m%d" }}{{ match.time | date: "%H%M00" }}
DTEND;TZID={{ site.timezone }}:{{ match.date | date: "%Y%m%d" }}{{ match.time | date: "%H%M00" | abs | plus: 200 }}
LOCATION:{{ match.location.name }}\, {{ match.location.street }}\, {{ match.location.postalCode }} {{ match.location.city }}
DESCRIPTION:Liga:{{ match.matchSeries.name }}\nTeam 1: {{ match.team[0].name }}\nTeam 2: {{ match.team[1].name }}\nGastgeber: {{ match.host.name }}\n{{ site.url | append: "/termine/" }}
END:VEVENT
            {%- endif -%}
        {%- endfor -%}
    {%- endif -%}
{%- endfor -%}
END:VCALENDAR