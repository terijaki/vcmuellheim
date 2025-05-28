import { samsClubData } from "@/utils/sams/sams-server-actions";
import { Text } from "@mantine/core";

export default async function ClubPage() {
	const clubData = await samsClubData();

	return <Text>ClubData: {JSON.stringify(clubData)}</Text>;
}
