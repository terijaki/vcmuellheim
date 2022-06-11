<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
---
Update: <xsl:value-of select="rankings/matchSeries/updated"/>
League: <xsl:value-of select="rankings/matchSeries/name"/>
LeagueRank: <xsl:value-of select="rankings/matchSeries/hierarchy/hierarchyLevel"/>
Season: <xsl:value-of select="rankings/matchSeries/season/name"/>
---
        <div class="rankings">
            <div>
                <div>Platz</div>
                <div>Mannschaft</div>
                <div>Siege</div>
                <div>Sätze</div>
                <div>Punkte</div>
            </div>
            <xsl:for-each select="rankings/ranking">
            <div>
                <div>
                    <xsl:value-of select="place"/>
                </div>
                <div>
                      <xsl:value-of select="team/name"/>
                </div>
                <div>
                    <xsl:value-of select="wins"/>
                </div>
                <div>
                    <xsl:value-of select="setPoints"/>
                </div>
                <div>
                    <xsl:value-of select="setPointDifference"/>
                </div>
            </div>
            </xsl:for-each>
            <div>
                Stand <xsl:value-of select="rankings/timestamp"/>
            </div>
        </div>
    </xsl:template>
</xsl:stylesheet>
