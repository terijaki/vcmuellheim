<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<!-- Check for matches -->
<xsl:template match="/">


<xsl:for-each select="matches/match">
    <xsl:if test="results/winner > 0">
    <xsl:variable name="matchid"><xsl:value-of select="uuid"/></xsl:variable>
    <xsl:result-document method="html" href="_individual_matches/{$matchid}.html">
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>id: {$matchid}</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>category: </xsl:text><xsl:value-of select="matchSeries/name"/>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>---</xsl:text>
            <xsl:value-of select="matchSeries/name"/><xsl:text>: </xsl:text>
            <xsl:for-each select="team">
                <xsl:sort select="number"/>
                <xsl:value-of select="name"/>
                <xsl:if test="number = 1">
                    <xsl:text> - </xsl:text>
                </xsl:if>
            </xsl:for-each>
            <xsl:text> (</xsl:text><xsl:value-of select="results/setPoints"/><xsl:text>) </xsl:text>
    </xsl:result-document>
    </xsl:if>
</xsl:for-each>


</xsl:template>

</xsl:stylesheet>