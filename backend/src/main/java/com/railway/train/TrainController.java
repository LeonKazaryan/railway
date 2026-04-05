package com.railway.train;

import com.railway.alert.model.Alert;
import com.railway.history.InMemoryHistoryStore;
import com.railway.history.model.TelemetryRecord;
import com.railway.util.DurationParser;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/trains")
@RequiredArgsConstructor
public class TrainController {

    private final InMemoryHistoryStore history;

    @GetMapping("/{id}/history")
    public List<TelemetryRecord> history(
            @PathVariable("id") UUID id,
            @RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return history.window(id, from, to);
    }

    @GetMapping("/{id}/alerts")
    public List<Alert> alerts(
            @PathVariable("id") UUID id,
            @RequestParam(value = "window", required = false) String window) {
        Duration d = DurationParser.parseWindow(window, Duration.ofMinutes(15));
        Instant to = Instant.now();
        Instant from = to.minus(d);
        return history.alertsWindow(id, from, to);
    }

    @GetMapping("/{id}/route")
    public List<double[]> route(
            @PathVariable("id") UUID id,
            @RequestParam(value = "window", required = false) String window) {
        Duration d = DurationParser.parseWindow(window, Duration.ofMinutes(60));
        Instant to = Instant.now();
        Instant from = to.minus(d);
        return history.window(id, from, to).stream()
                .map(r -> {
                    var t = r.getTelemetry();
                    if (t.getLat() != null && t.getLon() != null) {
                        return new double[] { t.getLat(), t.getLon() };
                    }
                    return null;
                })
                .filter(p -> p != null)
                .collect(Collectors.toList());
    }
}
