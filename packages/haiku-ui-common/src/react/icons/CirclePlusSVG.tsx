import * as React from 'react';
import Palette from './../../Palette';

export default ({color = Palette['SUNSTONE']}) => {
  return (
    <svg width="17px" height="17px" viewBox="0 0 17 17">
      <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <circle id="Oval" stroke={color} stroke-width="1.5" cx="8.5" cy="8.5" r="7.5"></circle>
        <path d="M8.75,4.5 L8.75,12.5" id="Line" stroke={color} stroke-width="1.5" stroke-linecap="square"></path>
        <path d="M12.5,8.5 L4.75,8.5" id="Line" stroke={color} stroke-width="1.5" stroke-linecap="square"></path>
      </g>
    </svg>
  );
};