<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration="yes"/>

<!-- Check for matches -->
<xsl:template match="/">


<xsl:for-each select="matches/match">
    <xsl:if test="contains(host/club, 'VC Müllheim')"> <!-- matches with VC Müllheim as HOST -->
    <xsl:if test="contains(team[1]/name, 'VC Müllheim') or contains(team[2]/name, 'VC Müllheim')"> <!-- matches with VC Müllheim as TEAM -->
    <xsl:variable name="matchid"><xsl:value-of select="uuid"/></xsl:variable>
    <xsl:result-document method="html" href="_heimspiele/{$matchid}.html">
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>id: "</xsl:text><xsl:value-of select="uuid"/>"
            <xsl:text>number: "</xsl:text><xsl:value-of select="number"/>"
            <xsl:text>date: "</xsl:text><xsl:value-of select="date"/>"
            <xsl:text>time: "</xsl:text><xsl:value-of select="time"/>"
            <xsl:text>datetime: "</xsl:text><xsl:value-of select="date"/><xsl:text> </xsl:text><xsl:value-of select="time"/>"
            <xsl:text>league: "</xsl:text><xsl:value-of select="matchSeries/name"/>"
            <xsl:text>host: "</xsl:text><xsl:value-of select="host/name"/>"
            <xsl:text>team1: "</xsl:text><xsl:value-of select="team[1]/name"/>"
            <xsl:text>team2: "</xsl:text><xsl:value-of select="team[2]/name"/>"
            <xsl:text>opponent: "</xsl:text>
            <xsl:choose><!-- condition in case VCM 1 hosts for VCM 2 -->
            <xsl:when test="team[1]/name != host/name and team[2]/name != host/name">
                <xsl:for-each select="team">
                <xsl:if test="not(contains(name, 'VC Müllheim'))">
                    <xsl:value-of select="name"/>
                </xsl:if>
                </xsl:for-each>"
            </xsl:when>
            <xsl:otherwise>
                <xsl:for-each select="team">
                <xsl:if test="name != ../host/name">
                <xsl:value-of select="name"/></xsl:if>
            </xsl:for-each>"
            </xsl:otherwise>
            </xsl:choose>
            <xsl:text>location_name: "</xsl:text><xsl:value-of select="location/name"/>"
            <xsl:text>location_street: "</xsl:text><xsl:value-of select="location/street"/>"
            <xsl:text>location_postal: "</xsl:text><xsl:value-of select="location/postalCode"/>"
            <xsl:text>location_city: "</xsl:text><xsl:value-of select="location/city"/>"
            <xsl:text>author: "SBVV-Online"</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
            <xsl:text>---</xsl:text>
            <xsl:text>&#xA;</xsl:text><!-- new line-->
    </xsl:result-document>
    </xsl:if>
    </xsl:if>
</xsl:for-each>


</xsl:template>

</xsl:stylesheet>