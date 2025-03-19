import { Separator as SeparatorPrimitive } from "bits-ui";
import { tv } from "tailwind-variants";

const separator = tv({
	base: "shrink-0 bg-border",
	variants: {
		orientation: {
			horizontal: "h-[1px] w-full",
			vertical: "h-full w-[1px]"
		}
	},
	defaultVariants: {
		orientation: "horizontal"
	}
});

const Root = SeparatorPrimitive.Root;

export {
	Root,
	//
	Root as Separator,
	separator
};
