<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <div class="col sams-rankings">
            <div class="box">
                <h1><xsl:value-of select="rankings/matchSeries/name"/></h1>
                <div class="sams-tabelle">
                    <table>
                        <thead>
                            <tr>
                                <th>Platz</th>
                                <th>Mannschaft</th>
                                <th>Siege</th>
                                <th>Sätze</th>
                                <th>Punkte</th>
                            </tr>
                        </thead>
                    <xsl:for-each select="rankings/ranking">
                        <tbody>
                            <tr>
                                <xsl:attribute name="team">
                                    <xsl:value-of select="team/name" />
                                </xsl:attribute>
                                <td>
                                    <xsl:value-of select="place"/>
                                </td>
                                <td>
                                    <xsl:value-of select="team/name"/>
                                </td>
                                <td>
                                    <xsl:value-of select="wins"/>
                                </td>
                                <td>
                                    <xsl:value-of select="setPoints"/>
                                </td>
                                <td>
                                    <xsl:value-of select="points"/>
                                </td>
                            </tr>
                        </tbody>
                </xsl:for-each>
                    </table>
                </div>
                <div class="footnote">
                    <div class="season">
                        Saison <xsl:value-of select="rankings/matchSeries/season/name"/>
                    </div>
                    <div class="timestamp">
                        Stand <xsl:value-of select="rankings/timestamp"/>
                    </div>
                </div>
            </div>
        </div>
    </xsl:template>
</xsl:stylesheet>