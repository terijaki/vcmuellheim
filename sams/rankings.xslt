<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <div class="col sams-rankings">
            <div class="box">
                <h1><xsl:value-of select="rankings/matchSeries/name"/></h1>
                <div class="footnote">
                    <div class="season">
                        Saison <xsl:value-of select="rankings/matchSeries/season/name"/>
                    </div>
                    <div class="timestamp">
                        Stand <xsl:value-of select="rankings/timestamp"/>
                    </div>
                </div>
                <div>
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
                        <tbody>
                    <xsl:for-each select="rankings/ranking">
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
                                    <xsl:value-of select="wins"/>/<xsl:value-of select="matchesPlayed"/>
                                </td>
                                <td>
                                    <xsl:value-of select="setPoints"/>
                                </td>
                                <td>
                                    <xsl:value-of select="points"/>
                                </td>
                            </tr>
                </xsl:for-each>
                            <tr class="noranking">
                                <td colspan="4">Für diese Saison stehen derzeit keine Ergebnisse bereit.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </xsl:template>
</xsl:stylesheet>