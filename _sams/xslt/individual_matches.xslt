<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<!-- Check for matches -->
<xsl:template match="/">


<xsl:for-each select="matches/match">
    <xsl:if test="results/winner > 0"> <!-- matches with results have the winner either as team 1 or 2 -->
    <xsl:variable name="matchid"><xsl:value-of select="uuid"/></xsl:variable>
    <xsl:result-document method="html" href="_spielergebnisse/{$matchid}.html">
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>id: "</xsl:text><xsl:value-of select="uuid"/>"
            <xsl:text>date: "</xsl:text><xsl:value-of select="matchSeries/resultsUpdated"/>"
            <xsl:text>datetime: "</xsl:text><xsl:value-of select="substring(date, 7, 4)"/>-<xsl:value-of select="substring(date, 4, 2)"/>-<xsl:value-of select="substring(date, 1, 2)"/>T<xsl:value-of select="time"/>"
            <xsl:text>title: "Spielergebnis: </xsl:text><xsl:value-of select="matchSeries/name"/>"
            <xsl:text>host: "</xsl:text><xsl:value-of select="host/name"/>"
            <xsl:text>team1: "</xsl:text><xsl:value-of select="team[1]/name"/>"
            <xsl:text>team2: "</xsl:text><xsl:value-of select="team[2]/name"/>"
            <xsl:text>category: "</xsl:text><xsl:value-of select="matchSeries/name"/>"
            <xsl:text>author: "SBVV-Online"</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:value-of select="matchSeries/name"/><xsl:text>: </xsl:text>
            <xsl:value-of select="team[1]/name"/> - <xsl:value-of select="team[2]/name"/>
            <xsl:text> (</xsl:text><xsl:value-of select="results/setPoints"/><xsl:text>) </xsl:text>
    </xsl:result-document>
    </xsl:if>
</xsl:for-each>


</xsl:template>

</xsl:stylesheet>