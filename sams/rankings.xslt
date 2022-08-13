<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes" method="html"/>
<xsl:template match="/">---
league_name: <xsl:value-of select="rankings/matchSeries/name"/>
league_id: <xsl:value-of select="rankings/matchSeries/id"/>
league_uuid: <xsl:value-of select="rankings/matchSeries/uuid"/>
league_season: <xsl:value-of select="rankings/matchSeries/season/name"/>
league_type: <xsl:value-of select="rankings/matchSeries/type"/>
---
    <div class="col-12 col-lg-6 mb-4 sams-rankings">
    <xsl:attribute name="liganame">
        <xsl:value-of select="rankings/matchSeries/name" />
    </xsl:attribute>
    <xsl:attribute name="ligaid">
        <xsl:value-of select="rankings/matchSeries/id" />
    </xsl:attribute>
    <xsl:attribute name="ligauuid">
        <xsl:value-of select="rankings/matchSeries/uuid" />
    </xsl:attribute>
        <div class="box m-0 p-3 p-sm-4 p-md-5 p-lg-4 p-xl-5">
            <h3 class="fw-bold"><xsl:value-of select="rankings/matchSeries/name"/></h3>
            <div class="footnote">
                <div class="season">
                    Saison <xsl:value-of select="rankings/matchSeries/season/name"/>
                </div>
                <div class="timestamp">
                    Stand <xsl:value-of select="rankings/timestamp"/>
                </div>
            </div>
            <div>
                <table class="w-100">
                    <thead>
                        <tr>
                            <th>Platz</th>
                            <th>Mannschaft</th>
                            <th>Siege</th>
                            <th>Sätze</th>
                            <th>Punkte</th>
                        </tr>
                    </thead>
                    <tbody>
                <xsl:for-each select="rankings/ranking">
                        <tr>
                            <xsl:attribute name="team">
                                <xsl:value-of select="team/name" />
                            </xsl:attribute>
                            <xsl:attribute name="teamid">
                                <xsl:value-of select="team/id" />
                            </xsl:attribute>
                            <xsl:attribute name="teamuuid">
                                <xsl:value-of select="team/uuid" />
                            </xsl:attribute>
                            <td>
                                <xsl:value-of select="place"/>
                            </td>
                            <td>
                                <xsl:value-of select="team/name"/>
                            </td>
                            <td>
                                <xsl:value-of select="wins"/>/<xsl:value-of select="matchesPlayed"/>
                            </td>
                            <td>
                                <xsl:value-of select="setPoints"/>
                            </td>
                            <td>
                                <xsl:value-of select="points"/>
                            </td>
                        </tr>
            </xsl:for-each>
                    <xsl:if test="not(rankings/ranking[0]/matchesPlayed > 0)">
                        <tr class="norankings">
                            <td colspan="4">Für diese Saison stehen derzeit keine Ergebnisse bereit.</td>
                        </tr>
                    </xsl:if>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</xsl:template>
</xsl:stylesheet>