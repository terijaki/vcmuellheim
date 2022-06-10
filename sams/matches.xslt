<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
---
Team: <xsl:value-of select="teamName"/>
League: <xsl:value-of select="league"/>
LeagueRank: <xsl:value-of select="LeagueRank"/>
---
        <div class="matches schedule <xsl:value-of select='pastfuture'/>">
            <<div>>
                <div>Datum</div>
                <div>Team 1</div>
                <div>Team 2</div>
                <div>Austragungsort</div>
            </div>
            <xsl:for-each select="matches/match">
                <div>
                    <div>
                        <xsl:value-of select="date"/><br/>
                        <xsl:value-of select="time"/> Uhr
                    </div>
                    <xsl:for-each select="team">
                        <xsl:sort select="number"/>
                        <div>
                            <xsl:value-of select="name"/>
                        </div>
                    </xsl:for-each>
                    <div>
                        <xsl:value-of select="location/city"/> (
                        <xsl:value-of select="location/street"/>)
                    </div>
                </div>
            </xsl:for-each>
        </div>
    </xsl:template>
</xsl:stylesheet>
