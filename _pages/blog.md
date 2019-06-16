---
layout: default
permalink: /blog/
---

<!--===== Intro =====-->
  <section id="intro">

    <div class="intro-text">
      <p>Neuigkeiten des Volleyballclub Müllheim e.V.</p>
    </div>
  </section>
<!--===== #intro =====-->

<main id="main">
    
<!--===== News =====-->
<section id="news" class="section-bg">
    <div class="container">
        <div class="section-header">
            <h3 class="section-title">News</h3>
            <span class="section-divider"></span>
            <p class="section-description"></p>
        </div>
        <div class="row newsposts">

            {% for post in site.posts %}
            <div class="col-lg-6">
                <div class="box wow fadeInUp" onclick="location.href='{{ site.baseurl }}{{ post.url }}';">
                    {% if post.thumbnail %}
                    <a href="{{ site.baseurl }}{{ post.url }}"><div class="thumbnail" style="background:linear-gradient(rgba(54,59,64, 0.9), rgba(54,98,115, 0.9)), url({{ post.thumbnail }});"></div></a>
                    {% endif %}
                    <h4 class="post-title"><a href="{{ site.baseurl }}{{ post.url }}">{{ post.title }}</a></h4>
                    <article class="post-excerpt">{{ post.excerpt }}</article>
                    <p class="post-url"><a href="{{ site.baseurl }}{{ post.url }}" class="read-more">weiterlesen</a></p>
                </div>
            </div>
            {% endfor %}

        </div>
    </div>
</section>
<!--===== #news =====-->

</main>
