package com.railway.util;

import java.time.Duration;

public final class DurationParser {

    private DurationParser() {}

    public static Duration parseWindow(String s, Duration def) {
        if (s == null || s.isBlank()) return def;
        String str = s.trim().toLowerCase();
        try {
            if (str.endsWith("ms")) {
                long v = Long.parseLong(str.substring(0, str.length() - 2));
                return Duration.ofMillis(v);
            } else if (str.endsWith("s")) {
                long v = Long.parseLong(str.substring(0, str.length() - 1));
                return Duration.ofSeconds(v);
            } else if (str.endsWith("m")) {
                long v = Long.parseLong(str.substring(0, str.length() - 1));
                return Duration.ofMinutes(v);
            } else if (str.endsWith("h")) {
                long v = Long.parseLong(str.substring(0, str.length() - 1));
                return Duration.ofHours(v);
            } else if (str.endsWith("d")) {
                long v = Long.parseLong(str.substring(0, str.length() - 1));
                return Duration.ofDays(v);
            } else {
                // try plain seconds
                long v = Long.parseLong(str);
                return Duration.ofSeconds(v);
            }
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
