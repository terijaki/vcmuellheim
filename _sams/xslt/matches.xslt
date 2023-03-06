<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>
<xsl:template match="/">---
layout: page
title: <xsl:value-of select="matches/match[1]/matchSeries/name"/> (Saison <xsl:value-of select="matches/match[1]/matchSeries/season/name"/>)
id: <xsl:value-of select="matches/match[1]/matchSeries/id"/>
uuid: <xsl:value-of select="matches/match[1]/matchSeries/uuid"/>
---
<main class="flex-grow-1 d-flex flex-column">
    <section id="matches" class="section-bg flex-grow-1">
        <div class="container">
            <div class="col sams-matches">

                <xsl:for-each select="matches/match">
                <xsl:if test="results/winner > 0">
                    <xsl:variable name="result-volume">true</xsl:variable>
                </xsl:if>
                </xsl:for-each>
                
                <div class="box matches-past">
                    <h3 class="fw-bold">Ergebnisse</h3>
                    <div class="past">

                        <div class="ergebnis-liste">

                            <xsl:for-each select="matches/match">
                            <xsl:if test="results/winner > 0">

                            <div class="match col-12 row text-nowrap m-0 py-2">
                            <xsl:attribute name="matchid">
                                <xsl:value-of select="id" />
                            </xsl:attribute>
                            <xsl:attribute name="matchnumber">
                                <xsl:value-of select="number" />
                            </xsl:attribute>

                                <div class="date-time col-12 col-lg-2 d-flex flex-lg-column align-items-center flex-wrap small">
                                    <span class="date d-lg-block"><xsl:value-of select="date"/></span>
                                </div> 

                                <div class="teams col-12 col-lg-5 d-lg-flex align-items-center fw-bold">
                                    <xsl:attribute name="winner">
                                            <xsl:value-of select="results/winner" />
                                    </xsl:attribute>
                                    <span class="team-a">
                                    <xsl:attribute name="teamid">
                                        <xsl:value-of select="team[1]/id" />
                                    </xsl:attribute>
                                    <xsl:value-of select="team[1]/name"/>
                                    </span>
                                    <span class="versus px-2">:</span>
                                    <span class="team-b">
                                    <xsl:attribute name="teamid">
                                        <xsl:value-of select="team[2]/id" />
                                    </xsl:attribute>
                                    <xsl:value-of select="team[2]/name"/>
                                    </span>
                                </div>

                                <div class="points col-12 col-lg-5 d-flex align-items-center">
                                    <i class="fa-solid fa-square-poll-vertical pe-2"><xsl:comment>score icon</xsl:comment></i><span><xsl:value-of select="results/setPoints"/> <small class="ps-2"> (<xsl:for-each select="results/sets/set"><xsl:if test="number > 1">, </xsl:if><xsl:value-of select="points"/></xsl:for-each>)</small></span>
                                </div>

                            </div>

                            </xsl:if>
                            </xsl:for-each>

                            <div class="col-12 p-3 nomatches past">Es liegen keine Ergebnisse für diese Saison vor.</div>   

                        </div>

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
                            <xsl:attribute name="matchid">
                                <xsl:value-of select="id" />
                            </xsl:attribute>
                            <xsl:attribute name="matchnumber">
                                <xsl:value-of select="number" />
                            </xsl:attribute>
                                <div class="date-time col-12 col-lg-2 d-flex flex-lg-column align-items-center flex-wrap small">
                                    <span class="date d-lg-block"><xsl:value-of select="date"/></span>
                                    <xsl:if test="not(time = '00:00')">
                                    <span class="px-1 d-lg-none">-</span>
                                    <span class="time d-lg-block"><xsl:value-of select="time"/> Uhr</span>
                                    </xsl:if>
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
                                    <span class="team-b">
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
                                    <a target="_blank" rel="noopener">
                                    <xsl:attribute name="href">
                                        <xsl:value-of select="concat('https://www.google.com/maps/search/?api=1&amp;query=',location/street,',',location/postalCode,'+',location/city,',',location/name)" />
                                    </xsl:attribute>
                                    <i class="fa-solid fa-location-dot pe-1"><xsl:comment>map location pin</xsl:comment></i><span><xsl:value-of select="location/city"/></span>
                                    <span class="ps-1">(<xsl:value-of select="location/street"/>)</span></a>
                                </div>


                            </div>
                            </xsl:if>
                            </xsl:for-each>
                            
                            <div class="col-12 p-3 nomatches future">Es liegen keine Spiele für diese Saison vor.</div>

                            <div class="mt-4 text-center calendar d-none"><!-- display-none-class removed and CALURL1/2 replaced by XSLT during successful ICS import -->
                                <a class="btn-small-download" type="text/calendar" href="CALURL1"><i class="fa-solid fa-download"><xsl:comment>download icon</xsl:comment></i> Spielplan herunterladen</a>
                                <a class="btn-small-download" type="text/calendar" href="CALURL2"><i class="fa-solid fa-arrows-rotate"><xsl:comment>refresh icon</xsl:comment></i> Spielplan abonnieren</a>
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