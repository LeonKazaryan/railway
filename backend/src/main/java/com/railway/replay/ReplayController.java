package com.railway.replay;

import com.railway.history.InMemoryHistoryStore;
import com.railway.history.model.TelemetryRecord;
import com.railway.util.DurationParser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ReplayController {

    private final InMemoryHistoryStore history;

    @GetMapping("/trains/{id}/replay")
    public List<TelemetryRecord> replay(
            @PathVariable("id") UUID id,
            @RequestParam(value = "window", required = false) String window) {
        Duration d = DurationParser.parseWindow(window, Duration.ofMinutes(15));
        Instant to = Instant.now();
        Instant from = to.minus(d);
        return history.window(id, from, to);
    }
}
