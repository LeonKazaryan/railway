package com.railway.reports;

import com.railway.history.InMemoryHistoryStore;
import com.railway.history.model.TelemetryRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportsController {

    private final InMemoryHistoryStore history;

    @GetMapping("/train/{id}/export.csv")
    public ResponseEntity<byte[]> exportCsv(
            @PathVariable("id") UUID id,
            @RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {

        List<TelemetryRecord> records = history.window(id, from, to);

        String header = "ts,lat,lon,speedKphEma,brakePressureKpaEma,motorTempC,health,status\n";
        String rows = records.stream().map(r -> {
            var t = r.getTelemetry();
            var h = r.getHealth();
            return String.format("%s,%s,%s,%s,%s,%s,%d,%s",
                    r.getTs(),
                    t.getLat() == null ? "" : t.getLat(),
                    t.getLon() == null ? "" : t.getLon(),
                    t.getSpeedKphEma() == null ? "" : t.getSpeedKphEma(),
                    t.getBrakePressureKpaEma() == null ? "" : t.getBrakePressureKpaEma(),
                    t.getMotorTempC() == null ? "" : t.getMotorTempC(),
                    h == null ? 0 : h.getHealth(),
                    h == null ? "" : h.getStatus());
        }).collect(Collectors.joining("\n"));

        String csv = header + rows + "\n";
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"train-" + id + ".csv\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(bytes);
    }
}
