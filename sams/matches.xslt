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
                                        <td>
                                            <xsl:value-of select="date"/>
                                        </td>
                                        <td>
                                            <div class="teams">
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
                                        <td>
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

                        <div class="termine-liste w-100">
                            
                        <xsl:for-each select="matches/match">
                        <xsl:if test="not(results/winner)">

                            <xsl:attribute name="hostid">
                                    <xsl:value-of select="host/id" />
                            </xsl:attribute>
                            <div class="date-time col-12 col-md-2">
                                <xsl:value-of select="date"/><span class="ps-2"><xsl:value-of select="time"/> Uhr</span>
                            </div>
                            <div class="teams col-12 col-md-5 font-weight-bold">
                                <xsl:attribute name="teamid">
                                    <xsl:value-of select="team[1]/id" />
                                </xsl:attribute>
                                <span><xsl:value-of select="team[1]/name"/></span>
                                <span class="versus px-3">:</span>
                                <xsl:attribute name="teamid">
                                    <xsl:value-of select="team[2]/id" />
                                </xsl:attribute>
                                <span><xsl:value-of select="team[2]/name"/></span>
                            </div>
                            <xsl:attribute name="city">
                                    <xsl:value-of select="location/city" />
                                </xsl:attribute>
                            <div class="location col-12 col-md-5">
                                <i class="fa-solid fa-map-marker-alt"></i>
                                <xsl:value-of select="location/city"/>
                                <span class="ps-2">(<xsl:value-of select="location/street"/>)</span>
                            </div>

                        </xsl:if>
                        </xsl:for-each>
                        
                        <div class="col-12 p-3 nomatches future">Es liegen keine Spiele für diese Saison vor.</div>

                        <div class="mt-4 text-center calendar d-none">
                            <a class="btn-small-download" type="text/calendar" href="CALURL1">Spielplan herunterladen</a>
                            <a class="btn-small-download" type="text/calendar" href="CALURL2">Spielplan abonnieren</a>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </section>
</main>
</xsl:template>
</xsl:stylesheet>