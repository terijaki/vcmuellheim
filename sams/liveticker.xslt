<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<!-- Check what to export -->
<xsl:template match="/" name="check">

    <xsl:for-each select="matches/match"> <!-- Condition to check if result is not null -->
        <xsl:for-each select="team">
        <xsl:if test="number = 1">
            <xsl:param name="team1"><xsl:value-of select="name"/></xsl:param>
        </xsl:if>
        <xsl:if test="number = 2">
            <xsl:param name="team2"><xsl:value-of select="name"/></xsl:param>
        </xsl:if>
        </xsl:for-each>
    <xsl:call-template name="export">
        <xsl:with-param name="matchid"><xsl:value-of select="id"/></xsl:with-param>
        <xsl:with-param name="league"><xsl:value-of select="matchSeries/name"/></xsl:with-param>
        <xsl:with-param name="result"><xsl:value-of select="results/setPoints"/></xsl:with-param>
        <xsl:with-param name="result">$team1</xsl:with-param>
        <xsl:with-param name="result">$team2</xsl:with-param>
    </xsl:call-template>

    </xsl:for-each>
    
</xsl:template>

<!-- Export Template -->
<xsl:template match="/" name="export">
<xsl:result-document method="xml" href="match/{$matchid}.xml" indent="yes">
<xsl:param name="matchid"/>
<xsl:param name="league"/>
<xsl:param name="team1"/>
<xsl:param name="team2"/>
<xsl:param name="results"/>

$matchid $league
$team1 vs. $team2
</xsl:result-document>
</xsl:template>

</xsl:stylesheet>