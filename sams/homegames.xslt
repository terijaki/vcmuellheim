<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<!-- Check for matches -->
<xsl:template match="/">


<xsl:for-each select="matches/match">
    <xsl:if test="contains(host/club, 'VC Müllheim')"> <!-- matches with VC Müllheim as HOST -->
    <xsl:if test="contains(team/name, 'VC Müllheim')"> <!-- matches with VC Müllheim as TEAM -->
    <xsl:variable name="matchid"><xsl:value-of select="uuid"/></xsl:variable>
    <xsl:result-document method="html" href="_heimspiele/{$matchid}.html">
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>id: "</xsl:text><xsl:value-of select="uuid"/>"
            <xsl:text>date: "</xsl:text><xsl:value-of select="date"/>"
            <xsl:text>category: "</xsl:text><xsl:value-of select="matchSeries/name"/>"
            <xsl:text>author: "SBVV-Online"</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:for-each select="team">
                <xsl:if test="name != ./host/name">
                opponent: <xsl:value-of select="name"/>
                </xsl:if>
            </xsl:for-each>
    </xsl:result-document>
    </xsl:if>
    </xsl:if>
</xsl:for-each>


</xsl:template>

</xsl:stylesheet>