<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<xsl:template match="/" name="check">
    <xsl:for-each select="matches/match"> <!-- Condition to check if result is not null -->
    <xsl:variable name="matchid"><xsl:value-of select="id"/></xsl:variable>
    <xsl:variable name="league"><xsl:value-of select="matchSeries/name"/></xsl:variable>
    <xsl:for-each select="team">
        <xsl:if test="number = 1">
            <xsl:variable name="team1"><xsl:value-of select="name"/></xsl:variable>
        </xsl:if>
        <xsl:if test="number = 2">
            <xsl:variable name="team2"><xsl:value-of select="name"/></xsl:variable>
        </xsl:if>
    </xsl:for-each>
    <xsl:variable name="result"><xsl:value-of select="results/setPoints"/></xsl:variable>
</xsl:template>


<xsl:template match="/" name="export">

<xsl:variable name="matchid"><xsl:value-of select="matches/match/id"/></xsl:variable>
<xsl:result-document method="xml" href="match/{$matchid}.xml" indent="yes">

<xsl:value-of select="matchSeries/name"/>
    <xsl:for-each select="team">
        <xsl:if test="number = 1">: </xsl:if>
        <xsl:if test="number = 2"> - </xsl:if>
        <xsl:value-of select="name"/>
    </xsl:for-each> (<xsl:value-of select="results/setPoints"/>) #liveticker

</xsl:result-document>
</xsl:template>

</xsl:stylesheet>