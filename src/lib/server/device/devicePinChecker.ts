//Check pin format, must be 6 digits shortlived
export function checkPinFormat(pin: string) {
    if (pin.length != 6) {
        return false;
    }
    return true;    
}
