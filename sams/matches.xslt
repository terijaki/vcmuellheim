<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>
<xsl:template match="/">---
layout: page
title: <xsl:value-of select="matches/match[1]/matchSeries/name"/> (Saison <xsl:value-of select="matches/match[1]/matchSeries/season/name"/>)
id: <xsl:value-of select="matches/match[1]/matchSeries/id"/>
uuid: <xsl:value-of select="matches/match[1]/matchSeries/uuid"/>
permalink: /matches/TEAMIDHERE
---
<main class="flex-grow-1 d-flex flex-column">
    <section id="matches" class="section-bg flex-grow-1">
        <div class="container">
            <div class="col sams-matches">

                <div class="box matches-past">
                    <h3 class="fw-bold">Ergebnisse</h3>
                    <div class="past">
                        <table class="w-100">
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Teams</th>
                                    <th>Sätze <small>(Punkte)</small></th>
                                </tr>
                            </thead>
                            <tbody>
                                <xsl:for-each select="matches/match">
                                <xsl:if test="results/winner > 0">
                                    <tr>
                                    <xsl:attribute name="winner">
                                        <xsl:value-of select="results/winner" />
                                    </xsl:attribute>
                                        <td class="datum">
                                            <xsl:value-of select="date"/>
                                        </td>
                                        <td>
                                            <div class="teams d-flex">
                                        <xsl:for-each select="team">
                                            <xsl:sort select="number"/>
                                            <div>
                                            <xsl:attribute name="teamnumber">
                                                <xsl:value-of select="number" />
                                            </xsl:attribute>
                                            <xsl:attribute name="teamid">
                                                <xsl:value-of select="id" />
                                            </xsl:attribute>
                                            <xsl:attribute name="team">
                                                <xsl:value-of select="name" />
                                            </xsl:attribute>
                                                <xsl:value-of select="name"/>
                                            </div>
                                        </xsl:for-each>
                                            </div>
                                        </td>
                                        <td class="points">
                                            <xsl:value-of select="results/setPoints"/><small> (<xsl:for-each select="results/sets/set"><xsl:if test="number > 1">, </xsl:if><xsl:value-of select="points"/></xsl:for-each>)</small>
                                        </td>
                                    </tr>
                                </xsl:if>
                                </xsl:for-each>
                                 <tr class="nomatches past">
                                    <td colspan="3">Es liegen keine Ergebnisse für diese Saison vor.</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="footnote timestamp">
                            Stand <xsl:value-of select="matches/timestamp"/>
                        </div>
                    </div>
                </div>

                <div class="box matches-future">
                    <h3 class="fw-bold">Termine</h3>
                    <div class="upcoming">

                        <div class="termine-liste">
                                
                            <xsl:for-each select="matches/match">
                            <xsl:if test="not(results/winner)">
                            <div class="match col-12 row text-nowrap m-0 py-2">
                                <div class="date-time col-12 col-lg-2 d-flex flex-lg-column align-items-center flex-wrap small">
                                    <span class="date d-lg-block"><xsl:value-of select="date"/></span>
                                    <span class="px-1 d-lg-none">-</span><br class="d-none d-lg-inital">
                                    <span class="time d-lg-block"><xsl:value-of select="time"/> Uhr</span>
                                </div>
                                <div class="teams col-12 col-lg-5 d-lg-flex align-items-center fw-bold">
                                <xsl:attribute name="hostid">
                                        <xsl:value-of select="host/id" />
                                </xsl:attribute>
                                    <span class="team-a">
                                        <xsl:attribute name="teamid">
                                            <xsl:value-of select="team[1]/id" />
                                        </xsl:attribute>
                                        <xsl:value-of select="team[1]/name"/>
                                    </span>
                                    <span class="versus px-2">:</span>
                                    <span class="team-a">
                                        <xsl:attribute name="teamid">
                                            <xsl:value-of select="team[2]/id" />
                                        </xsl:attribute>
                                        <xsl:value-of select="team[2]/name"/>
                                    </span>
                                </div>
                                <div class="location col-12 col-lg-5 d-flex align-items-center small">
                                    <xsl:attribute name="city">
                                        <xsl:value-of select="location/city" />
                                    </xsl:attribute>
                                    <a href="https://www.google.com/maps/search/?api=1&query=" target="_blank" rel="noopener">
                                    <xsl:attribute name="href">
                                        https://www.google.com/maps/search/?api=1&query=<xsl:value-of select="location/name"/>,<xsl:value-of select="location/street"/>,<xsl:value-of select="location/postalCode"/>+<xsl:value-of select="location/city"/>
                                    </xsl:attribute>
                                    <i class="fa-solid fa-location-dot pe-1"><xsl:comment>map location pin</xsl:comment></i><span><xsl:value-of select="location/city"/></span>
                                    <span class="ps-1">(<xsl:value-of select="location/street"/>)</span></a>
                                </div>


                            </div>
                            </xsl:if>
                            </xsl:for-each>
                            
                            <div class="col-12 p-3 nomatches future">Es liegen keine Spiele für diese Saison vor.</div>

                            <div class="mt-4 text-center calendar d-none"><!-- display-none-class removed and CALURL1/2 replaced by XSLT during successful ICS import -->
                                <a class="btn-small-download" type="text/calendar" href="CALURL1">Spielplan herunterladen</a>
                                <a class="btn-small-download" type="text/calendar" href="CALURL2">Spielplan abonnieren</a>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </section>
</main>
</xsl:template>
</xsl:stylesheet>