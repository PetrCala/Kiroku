import Foundation

/// A `URLProtocol` that intercepts every request so `KirokuAPI` can be tested
/// offline: tests install a `handler` that inspects the outgoing request and
/// returns a canned `(HTTPURLResponse, Data)` — or throws to simulate a transport
/// failure. The most recent request body is captured for envelope assertions.
final class MockURLProtocol: URLProtocol {
    /// Set per test. Throwing simulates a network/transport error.
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    /// Body of the last intercepted request (read out of the body stream).
    static var lastRequestBody: Data?

    static func reset() {
        handler = nil
        lastRequestBody = nil
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        MockURLProtocol.lastRequestBody = request.readBody()

        guard let handler = MockURLProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    /// Build a `URLSession` wired to this protocol.
    static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: configuration)
    }
}

private extension URLRequest {
    /// `URLProtocol` delivers a POST body via `httpBodyStream`, not `httpBody`.
    func readBody() -> Data? {
        if let body = httpBody {
            return body
        }
        guard let stream = httpBodyStream else {
            return nil
        }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 {
                break
            }
            data.append(buffer, count: read)
        }
        return data
    }
}
