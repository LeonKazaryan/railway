package com.railway.state.controller;

import com.railway.state.dto.TrainCurrentResponse;
import com.railway.state.mapper.TrainCurrentMapper;
import com.railway.state.store.TrainLiveStateStore;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trains")
@RequiredArgsConstructor
public class TrainCurrentController {

    private final TrainLiveStateStore trainLiveStateStore;
    private final TrainCurrentMapper trainCurrentMapper;

    @GetMapping("/{id}/current")
    public TrainCurrentResponse getCurrent(@PathVariable UUID id) {
        return trainCurrentMapper.toResponse(trainLiveStateStore.get(id));
    }
}
