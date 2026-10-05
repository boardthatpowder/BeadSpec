#[derive(Debug, PartialEq)]
pub struct SseFrame {
    pub event: Option<String>,
    pub id: Option<String>,
    pub data: String,
}
#[derive(Default)]
pub struct SseParser {
    buffer: Vec<u8>,
}
impl SseParser {
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<SseFrame>, String> {
        self.buffer.extend_from_slice(chunk);
        if self.buffer.len() > 2 * 1024 * 1024 {
            return Err("Journal frame exceeds 2 MiB".into());
        }
        let mut frames = Vec::new();
        loop {
            let boundary = [b"\n\n".as_slice(), b"\r\n\r\n".as_slice()]
                .iter()
                .filter_map(|ending| {
                    self.buffer
                        .windows(ending.len())
                        .position(|window| window == *ending)
                        .map(|position| (position, ending.len()))
                })
                .min_by_key(|(position, _)| *position);
            let Some((end, width)) = boundary else {
                break;
            };
            let raw =
                std::str::from_utf8(&self.buffer[..end]).map_err(|_| "Invalid journal UTF-8")?;
            let mut frame = SseFrame {
                event: None,
                id: None,
                data: String::new(),
            };
            let mut data = Vec::new();
            for line in raw.lines() {
                if line.starts_with(':') {
                    continue;
                }
                let (key, value) = line.split_once(':').unwrap_or((line, ""));
                let value = value.strip_prefix(' ').unwrap_or(value);
                match key {
                    "data" => data.push(value),
                    "event" => frame.event = Some(value.into()),
                    "id" if !value.contains('\0') => frame.id = Some(value.into()),
                    _ => {}
                }
            }
            frame.data = data.join("\n");
            if !data.is_empty() {
                frames.push(frame);
            }
            self.buffer.drain(..end + width);
        }
        Ok(frames)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn split_chunks_and_heartbeat() {
        let mut parser = SseParser::default();
        assert!(parser
            .push(b": ping\r\n\r\nid: 3\r\ndata: {\"seq\":")
            .unwrap()
            .is_empty());
        let frames = parser.push(b"3}\r\n\r\n").unwrap();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].data, "{\"seq\":3}");
        assert_eq!(frames[0].id.as_deref(), Some("3"));
    }
    #[test]
    fn multiline_and_named_truncation() {
        let mut parser = SseParser::default();
        let frames = parser
            .push(b"event: truncated\ndata: one\ndata: two\n\n")
            .unwrap();
        assert_eq!(frames[0].event.as_deref(), Some("truncated"));
        assert_eq!(frames[0].data, "one\ntwo");
    }
    #[test]
    fn malformed_utf8_rejected() {
        assert!(SseParser::default().push(&[255, 10, 10]).is_err());
    }
    #[test]
    fn bounded_frame() {
        assert!(SseParser::default().push(&vec![b'x'; 2_100_000]).is_err());
    }
    #[test]
    fn mixed_line_endings_keep_event_boundaries() {
        let mut parser = SseParser::default();
        let frames = parser.push(b"data: one\r\n\r\ndata: two\n\n").unwrap();
        assert_eq!(frames.len(), 2);
        assert_eq!(frames[0].data, "one");
        assert_eq!(frames[1].data, "two");
    }
}
