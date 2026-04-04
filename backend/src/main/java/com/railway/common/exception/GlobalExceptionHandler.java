package com.railway.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fields.put(error.getField(), error.getDefaultMessage()));

        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", Instant.now());
        response.put("status", 400);
        response.put("error", "Validation failed");
        response.put("fields", fields);
        return response;
    }

    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Map<String, Object> handleRuntime(RuntimeException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", Instant.now());
        response.put("status", 500);
        response.put("error", ex.getMessage());
        return response;
    }
}