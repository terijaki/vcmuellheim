---
title: Tabelle
permalink: "/tabelle/"
layout: page
---

<main class="flex-grow-1 d-flex flex-column">
  <!--===== Ergebnisse & Tabelle =====-->
  <section id="ergebnisse-tabelle" class="section-bg flex-grow-1">
    <div class="container px-0 px-sm-3">
      <div class="row teams my-4">
        
      {% include tabelle.html %}

      {% include ergebnisse.html matches_limit="9" showmore="true" %}

      </div>
    </div>
  </section>
</main>