<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>
<xsl:template match="/">
Test

<xsl:for-each select="matches/match">
<xsl:value-of select="matchSeries/name"/>
    <xsl:for-each select="team">
        <xsl:if test="number = 1">: </xsl:if>
        <xsl:if test="number = 2"> - </xsl:if>
        <xsl:value-of select="name"/>
    </xsl:for-each> (<xsl:value-of select="results/setPoints"/>) #liveticker
_
</xsl:for-each>

    
</xsl:template>
</xsl:stylesheet>