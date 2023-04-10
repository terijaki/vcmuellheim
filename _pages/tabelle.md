---
layout: page
title: Tabelle
permalink: /tabelle/
---

<main class="flex-grow-1 d-flex flex-column">
  <!--===== Ergebnisse & Tabelle =====-->
  <section id="ergebnisse-tabelle" class="section-bg flex-grow-1">
    <div class="container px-0 px-sm-3">
      <div class="row teams my-4">
        {% assign league_displayed = '' %}

        {% assign sorted-teams = site.teams | sort: 'liga' %}
        {% for team in sorted-teams %}
          {% if team.sbvv_id > 0 %}
          
            {% for ranking in site.rankings %}
              {% if ranking.league_type == "League" and ranking.content contains team.sbvv_id %}

                {% unless league_displayed contains ranking.league_uuid %}
                  {{ ranking }}
                  {% assign league_displayed = league_displayed | append: ranking.league_uuid %}
                {% endunless %}

              {% endif %}
            {% endfor %}
          {% endif %}
        {% endfor %}

{% include ergebnisse.html matches_limit="9" showmore="true" %}

      </div>
    </div>
  </section>
</main>