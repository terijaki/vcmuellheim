import React from "react";

export default function SectionHeading(props: { text: string; classes?: string }) {
	return (
		<div className="flex justify-center">
			<h2 className={`text-onyx text-2xl tracking-wider font-thin p-0 m-6 inline-block text-center border-b-2 border-onyx before:-m-2 after:-m-2 whitespace-nowrap ${props.classes}`}>
				{props.text}
			</h2>
		</div>
	);
}
