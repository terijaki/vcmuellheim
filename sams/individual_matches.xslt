<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<!-- Check for matches -->
<xsl:template match="/">


<xsl:for-each select="matches/match">
    <xsl:if test="results/winner > 0">
    <xsl:variable name="matchid"><xsl:value-of select="id"/></xsl:variable>
    <xsl:result-document method="html" href="_individual_matches/{$matchid}.html">
            <xsl:value-of select="matchSeries/name"/><xsl:text>: </xsl:text>
            <xsl:for-each select="team">
                <xsl:sort select="number"/>
                <xsl:if test="number = 2">
                    <xsl:text> - </xsl:text><xsl:value-of select="name"/>
                </xsl:if>
            </xsl:for-each>
            <xsl:text> (</xsl:text><xsl:value-of select="results/setPoints"/><xsl:text>) </xsl:text>

    </xsl:result-document>
    </xsl:if>
</xsl:for-each>


</xsl:template>

</xsl:stylesheet>