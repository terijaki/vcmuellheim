---
title: Fotogalerie
permalink: "/fotos/"
layout: page
---

<main class="flex-grow-1 d-flex flex-column">
  <!--===== Foto Gallerie =====-->
  <section id="fotos" class="section-bg flex-grow-1">
    <div class="container mt-5">
      <div class="box text-center">
        <p class="p-0 m-0">Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern. <small>(zufällige Reihenfolge)</small></p>
      </div>
    </div>

    <div class="p-2">
      <div class="foto-box text-center">
        {% assign galleryfolder = '/upload/' %}
        {% for file in site.static_files %}
          {% if file.path contains galleryfolder %}
            {% assign low_extname = file.extname | downcase  %}
            {% if low_extname == '.jpg' or low_extname == '.jpeg' or low_extname == '.png' %}

              {% assign thumbnail = file.path | replace: "/upload/", "/thumbnails/gallery/" %}
              {% assign thumbnail_exist = false %}
              {% for file in site.static_files %}
                {% if file.path == thumbnail %}
                  {% assign thumbnail_exist = true %}
                {% endif %}
              {% endfor %}

              {% if thumbnail_exist == true %}
                <a href="{{ file.path }}" target="_blank" class="d-inline-block foto">
                  <img src="{{ thumbnail }}" style="width:260px;height:200px;" class="rounded-2 m-2 loadingspinner" name="{{ file.basename }}" loading="lazy" />
                </a>
              {% else %}
                <a href="{{ file.path }}" target="_blank" class="d-inline-block foto">
                  <img src="{{ file.path }}" style="width:260px;height:200px;" class="rounded-2 m-2 loadingspinner" name="{{ file.basename }}" loading="lazy" />
                </a>
              {% endif %}

            {% endif %}
          {% endif %}
        {% endfor %}
      </div>
    </div>
  </section>
</main>
