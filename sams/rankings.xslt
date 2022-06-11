<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
---
Update: <xsl:value-of select="matchSeries/updated"/>
League: <xsl:value-of select="matchSeries/name"/>
LeagueRank: <xsl:value-of select="matchSeries/type/hiearchy/hierarchyLevel"/>
---
        <div class="rankings">
            <div>
                <div>Platz</div>
                <div>Mannschft</div>
                <div>Siege</div>
                <div>Sätze</div>
                <div>Punkte</div>
            </div>
            <xsl:for-each select="ranking">
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
                Stand: <xsl:value-of select="matchSeries/updated"/>
            </div>
        </div>
    </xsl:template>
</xsl:stylesheet>
