// rounds a number to a fixed decimal places and avoids unintentional use of exponents
export const round = (value = 0, decimals = 0) => {
	return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals).toFixed(decimals)
}
