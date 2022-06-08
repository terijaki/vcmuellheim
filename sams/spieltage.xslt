<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <h2>Spieltage</h2>
        <table>
            <tr>
                <th>Datum</th>
                <th>Team 1</th>
                <th>Team 2</th>
                <th>Austragungsort</th>
            </tr>
            <xsl:for-each select="matches/match">
                <tr>
                    <td>
                        <xsl:value-of select="date"/>
                        <br/>
                        <xsl:value-of select="time"/> Uhr
                    </td>
                    <xsl:for-each select="team">
                        <xsl:sort select="number"/>
                        <td>
                            <xsl:value-of select="name"/>
                        </td>
                    </xsl:for-each>
                    <td>
                        <xsl:value-of select="location/city"/> (
                        <xsl:value-of select="location/street"/>)
                    </td>
                </tr>
            </xsl:for-each>
        </table>
    </xsl:template>
</xsl:stylesheet>
