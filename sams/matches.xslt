<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
---
layout: page
title: <xsl:value-of select="matches/match[1]/matchSeries/name"/>
permalink: /matches/TEAMID
---
        <div class="col sams-matches">
            <div class="box matches-past">
                <h1>Ergebnisse</h1>
                <div class="past">
                    <table>
                        <thead>
                            <tr>
                                <tr>Datum</tr>
                                <tr>Team 1</tr>
                                <tr>Team 2</tr>
                                <tr>Sätze (Bälle)</tr>
                            </tr>
                        </thead>
                        <tbody>
                            <xsl:for-each select="matches/match">
                            <xsl:if test="results/winner > 0">
                                <tr>
                                <xsl:attribute name="hostid">
                                    <xsl:value-of select="host/id" />
                                </xsl:attribute>
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
                                    <xsl:attribute name="teamid">
                                       <xsl:value-of select="id" />
                                    </xsl:attribute>
                                        <xsl:value-of select="name"/>
                                    </td>
                                </xsl:for-each>
                                    <td>
                                        <xsl:value-of select="results/setPoints"/> (<xsl:value-of select="results/sballPointst"/>)
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
                                <tr>Datum</tr>
                                <tr>Team 1</tr>
                                <tr>Team 2</tr>
                                <tr>Austragungsort</tr>
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
    </xsl:template>
</xsl:stylesheet>
