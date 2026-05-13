/**
 * Date utility functions for Playwright tests
 */
class DateUtils {
    /**
     * Convert relative time strings like "1 hour ago", "7 days ago" to minutes
     * Returns positive numbers if future and negative numbers if pass
     * Example: "1 hour ago" -> -60, "in 7 hours" -> 420
     */
    static relativeToMinutes(text) {
        if (!text) return 0;
        const str = text.toLowerCase().trim();
        let num = parseInt(str, 10);
        if (isNaN(num)) return 0;

        if (str.includes('hour')) {
            num = num * 60;
        } else if (str.includes('day')) {
            num = num * 60 * 24;
        } else if (str.includes('week')) {
            num = num * 60 * 24 * 7;
        } else if (str.includes('month')) {
            num = num * 60 * 24 * 30;
        }

        return str.includes('ago') ? num * -1 : num;
    }

    /**
     * Compare two date strings in format "MM/DD/YYYY - h:mm AM/PM"
     */
    static compareDates(dateStr1, dateStr2) {
        try {
            const [datePart1, timePart1] = dateStr1.split(' - ');
            const [datePart2, timePart2] = dateStr2.split(' - ');

            const [month1, day1, year1] = datePart1.split('/').map(Number);
            const [month2, day2, year2] = datePart2.split('/').map(Number);

            const date1 = this._buildDate(year1, month1, day1, timePart1);
            const date2 = this._buildDate(year2, month2, day2, timePart2);

            return date1.getTime() - date2.getTime();
        } catch (error) {
            console.error(`Error comparing dates: ${dateStr1} vs ${dateStr2}`, error);
            return dateStr1.localeCompare(dateStr2);
        }
    }

    static _buildDate(year, month, day, timeStr) {
        const match = timeStr.match(/(\d+):(\d+)\s(AM|PM)/i);
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();

        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        return new Date(year, month - 1, day, hours, minutes);
    }
}

module.exports = DateUtils;
