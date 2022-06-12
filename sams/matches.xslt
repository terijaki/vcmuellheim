<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
---
layout: page
title: <xsl:value-of select="matches/match[1]/matchSeries/name"/>
permalink: /matches/TEAMIDHERE
---
<main id="main" class="section-bg">
    <section id="matches">
        <div class="container">
            <div class="col sams-matches">
                <div class="box matches-past">
                    <h1>Ergebnisse</h1>
                    <div class="past">
                        <table>
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Team 1</th>
                                    <th>Team 2</th>
                                    <th>Sätze (Bälle)</th>
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
                                            <xsl:value-of select="date"/><br/>
                                            <xsl:value-of select="time"/> Uhr
                                        </td>    
                                    <xsl:for-each select="team">
                                        <xsl:sort select="number"/>
                                        <td>
                                        <xsl:attribute name="teamnumer">
                                            <xsl:value-of select="number" />
                                        </xsl:attribute>
                                        <xsl:attribute name="teamid">
                                        <xsl:value-of select="id" />
                                        </xsl:attribute>
                                            <xsl:value-of select="name"/>
                                        </td>
                                    </xsl:for-each>
                                        <td>
                                            <xsl:value-of select="results/setPoints"/> (<xsl:for-each select="results/sets/set"><xsl:if test="number > 1">, </xsl:if><xsl:value-of select="points"/></xsl:for-each>)
                                        </td>
                                    </tr>
                                </xsl:if>
                                </xsl:for-each>
                            </tbody>
                        </table>
                        <div>
                            Stand <xsl:value-of select="matches/timestamp"/>
                        </div>
                    </div>
                </div>

                <div class="box matches-future">
                    <h1>Spielplan</h1>
                    <div class="upcoming">
                        <table>
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Team 1</th>
                                    <th>Team 2</th>
                                    <th>Austragungsort</th>
                                </tr>
                            </thead>
                            <tbody>
                                <xsl:for-each select="matches/match">
                                <xsl:if test="not(results/winner)">
                                    <tr>
                                    <xsl:attribute name="hostid">
                                        <xsl:value-of select="host/id" />
                                    </xsl:attribute>
                                        <td>
                                            <xsl:value-of select="date"/><br/>
                                            <xsl:value-of select="time"/> Uhr
                                        </td>    
                                    <xsl:for-each select="team">
                                        <xsl:sort select="number"/>
                                        <td>
                                        <xsl:attribute name="teamid">
                                        <xsl:value-of select="id" />
                                        </xsl:attribute>
                                            <xsl:value-of select="name"/>
                                        </td>
                                    </xsl:for-each>
                                        <td>
                                            <xsl:value-of select="location/city"/> (
                                            <xsl:value-of select="location/street"/>)
                                        </td>
                                    </tr>
                                </xsl:if>
                                </xsl:for-each>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    </section>
</main>
    </xsl:template>
</xsl:stylesheet>
