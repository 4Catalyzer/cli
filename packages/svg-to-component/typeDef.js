module.exports = `
import {
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
  SVGProps,
} from 'react';

declare const Svg: ForwardRefExoticComponent<
  PropsWithoutRef<SVGProps<SVGSVGElement>> & RefAttributes<SVGSVGElement>
>;

export default Svg;
`;
