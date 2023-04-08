<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>
<xsl:template match="/">---
layout: page
title: Termine
permalink: /termine/
---
<main class="flex-grow-1 d-flex flex-column">
    <section id="matches" class="section-bg flex-grow-1">
        <div class="container">
            <div class="col sams-matches">
                
                <div class="box matches-future">
                    <div class="text-center calendar">
                        <a class="btn-small-download mt-0 mb-4" type="text/calendar" href="webcal://vcmuellheim.de/ics/all.ics"><i class="fa-solid fa-arrows-rotate"><xsl:comment>refresh icon</xsl:comment></i> Kalender abonnieren</a>
                    </div>
                    <div class="upcoming">

                        <div class="termine-liste">
                                
                            <xsl:for-each select="matches/match">
                            <xsl:sort select="substring(date, 7, 4)" order="ascending" data-type="number"/>
                            <xsl:sort select="substring(date, 4, 2)" order="ascending" data-type="number"/>
                            <xsl:sort select="substring(date, 1, 2)" order="ascending" data-type="number"/>
                            <xsl:sort select="number" order="ascending" data-type="number"/>
                            <xsl:if test="not(results/winnerDISABLE)">
                            <div class="match col-12 row text-nowrap m-0 py-2">
                            <xsl:attribute name="match-id">
                                <xsl:value-of select="id" />
                            </xsl:attribute>
                            <xsl:attribute name="match-number">
                                <xsl:value-of select="number" />
                            </xsl:attribute>
                                <div class="date-time col-12 col-lg-2 d-flex flex-lg-column align-items-center flex-wrap small">
                                    <span class="date d-lg-block"><xsl:value-of select="date"/></span>
                                    <xsl:if test="not(time = '00:00')">
                                    <span class="px-1 d-lg-none">-</span>
                                    <span class="time d-lg-block"><xsl:value-of select="time"/> Uhr</span>
                                    </xsl:if>
                                </div>
                                <div class="teams col-12 col-lg-5">
                                <xsl:attribute name="hostid">
                                        <xsl:value-of select="host/id" />
                                </xsl:attribute>
                                    <div class="fw-bold">
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
                                    <div>
                                        <span class="league-name d-lg-block small text-success"><xsl:value-of select="matchSeries/name"/></span>
                                    </div>
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
                            
                            <div class="col-12 p-3 nomatches future">Es liegen noch keine neuen Spieldaten vor.</div>


                        </div>
                    </div>
                </div>

            </div>
        </div>
    </section>
</main>
</xsl:template>
</xsl:stylesheet>