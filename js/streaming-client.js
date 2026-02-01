// js/streaming-client.js 

// WebRTC Streaming Client
class StreamingClient {
    constructor(hubUrl, accessToken) {
        this.hubUrl = hubUrl;
        this.accessToken = accessToken;
        this.connection = null;
        this.peerConnections = new Map();
        this.localStream = null;
        this.producers = new Map();
        this.consumers = new Map();
        this.currentRoomId = null;
        
        this.configuration = {
    iceServers: [
        { urls: 'stun:stun.services.mozilla.com:3478' },
        
        {
            urls: [
                'turn:turn.relay.metered.ca:80',
                'turn:turn.relay.metered.ca:443'
            ],
            username: 'free',
            credential: 'free'
        }
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10
};
        
        this.audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
            sampleSize: 16
        };
    }

    async connect() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(`${this.hubUrl}/hubs/streaming`, {
                accessTokenFactory: () => this.accessToken,
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                    if (retryContext.elapsedMilliseconds < 60000) {
                        return Math.random() * 10000;
                    } else {
                        return null;
                    }
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this.setupEventHandlers();

        try {
            await this.connection.start();
            console.log('SignalR Connected');
            return true;
        } catch (err) {
            console.error('SignalR Connection Error:', err);
            return false;
        }
    }

    setupEventHandlers() {
        this.connection.on('StreamStarted', (data) => {
            console.log('Stream started:', data);
            this.onStreamStarted(data);
        });

        this.connection.on('JoinedStream', (data) => {
            console.log('Joined stream:', data);
            this.onJoinedStream(data);
        });

        this.connection.on('ProducerCreated', async (data) => {
            console.log('Producer created:', data);
            await this.handleProducerCreated(data);
        });

        this.connection.on('NewProducer', async (data) => {
            console.log('New producer available:', data);
            this.onNewProducer(data);
        });

        this.connection.on('ConsumerCreated', async (data) => {
            console.log('Consumer created:', data);
            await this.handleConsumerCreated(data);
        });

        this.connection.on('ProducerPaused', (data) => {
            console.log('Producer paused:', data);
            this.onProducerPaused(data);
        });

        this.connection.on('ProducerResumed', (data) => {
            console.log('Producer resumed:', data);
            this.onProducerResumed(data);
        });

        this.connection.on('ProducerClosed', (data) => {
            console.log('Producer closed:', data);
            this.onProducerClosed(data);
        });

        this.connection.on('UserJoinedStream', (data) => {
            console.log('User joined:', data);
            this.onUserJoined(data);
        });

        this.connection.on('UserLeftStream', (data) => {
            console.log('User left:', data);
            this.onUserLeft(data);
        });

        this.connection.on('ReceiveStreamMessage', (data) => {
            console.log('Message received:', data);
            this.onMessageReceived(data);
        });

        this.connection.on('StreamEnded', (data) => {
            console.log('Stream ended:', data);
            this.onStreamEnded(data);
        });
        
        // Co-host events
        this.connection.on('CoHostInvite', (data) => {
            console.log('Co-host invite received:', data);
            this.onCoHostInvite(data);
        });
        
        this.connection.on('CoHostAdded', (data) => {
            console.log('Co-host added:', data);
            this.onCoHostAdded(data);
        });
        
        this.connection.on('CoHostRemoved', (data) => {
            console.log('Co-host removed:', data);
            this.onCoHostRemoved(data);
        });
        
        this.connection.on('CoHostLeft', (data) => {
            console.log('Co-host left:', data);
            this.onCoHostLeft(data);
        });
        
        this.connection.on('CoHostMediaRemoved', (data) => {
            console.log('Co-host media removed:', data);
            this.onCoHostMediaRemoved(data);
        });
        
        this.connection.on('UserRemoved', (data) => {
            console.log('User removed:', data);
            this.onUserRemoved(data);
        });
        
        this.connection.on('UserBlocked', (data) => {
            console.log('User blocked:', data);
            this.onUserBlocked(data);
        });

        this.connection.on('Error', (data) => {
            console.error('Hub error:', data);
            this.onError(data);
        });

        this.connection.on('ReceiveOfferFromConsumer', async (data) => {
            await this.handleOfferFromConsumer(data);
        });

        this.connection.on('ReceiveAnswerFromProducer', async (data) => {
            await this.handleAnswerFromProducer(data);
        });

        this.connection.on('ReceiveIceCandidateFromConsumer', async (data) => {
            await this.handleIceCandidateFromConsumer(data);
        });

        this.connection.on('ReceiveIceCandidateFromProducer', async (data) => {
            await this.handleIceCandidateFromProducer(data);
        });

        this.connection.onreconnecting(() => {
            console.log('Reconnecting...');
        });

        this.connection.onreconnected(() => {
            console.log('Reconnected');
        });

        this.connection.onclose(() => {
            console.log('Connection closed');
        });

        this.connection.on('CoHostMediaRemoved', (data) => {
            console.log('Co-host media removed:', data);
            this.onCoHostMediaRemoved(data);
        });
    }

    onCoHostMediaRemoved(data) {
        console.log('Co-host media removed (default handler):', data);
    }

    async startStream(username, userId, title, description, category, visibility, type) {
        try {
            await this.connection.invoke('StartStream', username, userId, title, description, category, visibility, type);
        } catch (err) {
            console.error('Error starting stream:', err);
            throw err;
        }
    }

    async joinStream(roomId, userId, username) {
        try {
            await this.connection.invoke('JoinStream', roomId, userId, username);
        } catch (err) {
            console.error('Error joining stream:', err);
            throw err;
        }
    }

    async startProducing(roomId, constraints = { audio: true, video: true }) {
        try {
            const enhancedConstraints = {
                audio: constraints.audio ? this.audioConstraints : false,
                video: constraints.video ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30, max: 30 }
                } : false
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(enhancedConstraints);
            
            console.log('Got media stream with tracks:', this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`));
            
            if (constraints.audio && this.localStream.getAudioTracks().length > 0) {
                await this.produceTrack(roomId, 'audio', this.localStream.getAudioTracks()[0]);
            }

            if (constraints.video && this.localStream.getVideoTracks().length > 0) {
                await this.produceTrack(roomId, 'video', this.localStream.getVideoTracks()[0]);
            }

            return this.localStream;
        } catch (err) {
            console.error('Error starting production:', err);
            throw err;
        }
    }

    async produceTrack(roomId, kind, track) {
        try {
            if (!this.producerTracks) {
                this.producerTracks = new Map();
            }
            this.producerTracks.set(kind, track);

            this.currentRoomId = roomId;

            await this.connection.invoke('ProduceMedia', roomId, kind, {
                type: 'offer',
                sdp: ''
            });

            console.log(`Stored ${kind} track for production`);

        } catch (err) {
            console.error(`Error producing ${kind}:`, err);
            throw err;
        }
    }

    async handleProducerCreated(data) {
        const { producerId, kind } = data;
        this.producers.set(producerId, kind);
        console.log(`${kind} producer created with ID: ${producerId}`);
    }

    async consumeMedia(roomIdOrProducerId, producerIdParam = null) {
        try {
            let roomId, producerId;
            
            if (producerIdParam) {
                roomId = roomIdOrProducerId;
                producerId = producerIdParam;
            } else {
                roomId = this.currentRoomId;
                producerId = roomIdOrProducerId;
            }
            
            if (!roomId) {
                console.error('No room ID available for consuming media');
                return;
            }
            
            console.log(`Requesting to consume media: roomId=${roomId}, producerId=${producerId}`);
            await this.connection.invoke('ConsumeMedia', roomId, producerId);
        } catch (err) {
            console.error('Error consuming media:', err);
        }
    }

    async handleConsumerCreated(data) {
        const { consumerId, producerId, producerUserId, kind } = data;

        try {
            console.log(`Creating consumer for ${kind} from producer ${producerUserId}`);
            
            let pc = this.consumerPcMapping?.get(producerUserId);
            let isNewConnection = false;
            
            if (pc && (pc.connectionState === 'closed' || pc.signalingState === 'closed')) {
                console.log('Existing peer connection is closed, creating new one');
                pc.close();
                this.consumerPcMapping.delete(producerUserId);
                if (this.pendingIceCandidates) {
                    this.pendingIceCandidates.delete(producerUserId);
                }
                pc = null;
            }
            
            if (!pc) {
                pc = new RTCPeerConnection(this.configuration);
                isNewConnection = true;
                console.log('Created NEW peer connection for producer', producerUserId);
                
                pc.ontrack = (event) => {
                    console.log(`✓ Received track from producer ${producerUserId}`, event.track.kind, event);
                    const stream = event.streams[0];
                    
                    let existingVideoElement = document.getElementById(`remote-${producerUserId}`);
                    if (existingVideoElement && existingVideoElement.srcObject) {
                        console.log('Adding track to existing stream');
                        const existingStream = existingVideoElement.srcObject;
                        existingStream.addTrack(event.track);
                    } else {
                        console.log('Creating new stream for producer');
                        this.onRemoteStream(stream, producerUserId, event.track.kind);
                    }
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('Sending ICE candidate to producer');
                        this.connection.invoke('SendIceCandidateToProducer', this.currentRoomId, producerUserId, {
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex
                        }).catch(console.error);
                    }
                };

                pc.onconnectionstatechange = () => {
                    console.log(`Consumer connection state to ${producerUserId}:`, pc.connectionState);
                };

                pc.oniceconnectionstatechange = () => {
                    console.log(`Consumer ICE state to ${producerUserId}:`, pc.iceConnectionState);
                };
                
                if (!this.consumerPcMapping) {
                    this.consumerPcMapping = new Map();
                }
                this.consumerPcMapping.set(producerUserId, pc);
                
                if (!this.pendingIceCandidates) {
                    this.pendingIceCandidates = new Map();
                }
                this.pendingIceCandidates.set(producerUserId, {
                    candidates: [],
                    remoteDescriptionSet: false
                });
            } else {
                console.log('Reusing existing peer connection for producer', producerUserId);
            }

            console.log(`Adding ${kind} transceiver`);
            pc.addTransceiver(kind, { direction: 'recvonly' });

            if (isNewConnection || pc.signalingState === 'stable') {
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await pc.setLocalDescription(offer);
                console.log(`Created offer for ${kind}`);

                await new Promise((resolve) => {
                    if (pc.iceGatheringState === 'complete') {
                        console.log('ICE gathering complete');
                        resolve();
                    } else {
                        console.log('Waiting for ICE gathering...');
                        const timeout = setTimeout(() => {
                            console.log('ICE gathering timeout - proceeding');
                            resolve();
                        }, 3000);
                        
                        pc.addEventListener('icegatheringstatechange', () => {
                            console.log('ICE gathering state:', pc.iceGatheringState);
                            if (pc.iceGatheringState === 'complete') {
                                clearTimeout(timeout);
                                resolve();
                            }
                        });
                    }
                });

                console.log('Sending offer to producer...');
                await this.connection.invoke('SendOfferToProducer', this.currentRoomId, producerUserId, {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp
                });
            }

            this.peerConnections.set(`consumer-${consumerId}`, pc);
            this.consumers.set(consumerId, { kind, producerUserId });
            
            console.log(`Consumer setup complete for ${kind} from producer ${producerUserId}`);

        } catch (err) {
            console.error('Error handling consumer creation:', err);
        }
    }

    async pauseProducer(roomId, producerId) {
        await this.connection.invoke('PauseProducer', roomId, producerId);
        
        const kind = this.producers.get(producerId);
        if (kind && this.localStream) {
            const tracks = kind === 'audio' ? this.localStream.getAudioTracks() : this.localStream.getVideoTracks();
            tracks.forEach(track => track.enabled = false);
        }
    }

    async resumeProducer(roomId, producerId) {
        await this.connection.invoke('ResumeProducer', roomId, producerId);
        
        const kind = this.producers.get(producerId);
        if (kind && this.localStream) {
            const tracks = kind === 'audio' ? this.localStream.getAudioTracks() : this.localStream.getVideoTracks();
            tracks.forEach(track => track.enabled = true);
        }
    }

    async closeProducer(roomId, producerId) {
        await this.connection.invoke('CloseProducer', roomId, producerId);
        
        const kind = this.producers.get(producerId);
        const pc = this.peerConnections.get(`producer-${kind}`);
        if (pc) {
            pc.close();
            this.peerConnections.delete(`producer-${kind}`);
        }
        this.producers.delete(producerId);
    }

    async sendMessage(roomId, message) {
        await this.connection.invoke('SendStreamMessage', roomId, message);
    }
    
    // Co-host management methods
    async inviteCoHost(roomId, targetUsername, targetUserId) {
        try {
            await this.connection.invoke('InviteCoHost', roomId, targetUsername, targetUserId);
        } catch (err) {
            console.error('Error inviting co-host:', err);
            throw err;
        }
    }
    
    async acceptCoHostInvite(roomId) {
        try {
            await this.connection.invoke('AcceptCoHostInvite', roomId);
        } catch (err) {
            console.error('Error accepting co-host invite:', err);
            throw err;
        }
    }
    
    async rejectCoHostInvite(roomId) {
        try {
            await this.connection.invoke('RejectCoHostInvite', roomId);
        } catch (err) {
            console.error('Error rejecting co-host invite:', err);
            throw err;
        }
    }
    
    async removeCoHost(roomId, targetUsername, targetUserId) {
        try {
            await this.connection.invoke('RemoveCoHost', roomId, targetUsername, targetUserId);
        } catch (err) {
            console.error('Error removing co-host:', err);
            throw err;
        }
    }
    
    async leaveCoHost(roomId) {
        try {
            await this.connection.invoke('LeaveCoHost', roomId);
        } catch (err) {
            console.error('Error leaving co-host:', err);
            throw err;
        }
    }
    
    // User management methods
    async removeUser(roomId, targetUsername, targetUserId) {
        try {
            await this.connection.invoke('RemoveUser', roomId, targetUsername, targetUserId);
        } catch (err) {
            console.error('Error removing user:', err);
            throw err;
        }
    }
    
    async blockUser(roomId, targetUsername, targetUserId) {
        try {
            await this.connection.invoke('BlockUser', roomId, targetUsername, targetUserId);
        } catch (err) {
            console.error('Error blocking user:', err);
            throw err;
        }
    }

    async leaveStream(roomId, isHostLeaving = false) {
        this.peerConnections.forEach(pc => {
            if (pc && pc.connectionState !== 'closed') {
                pc.close();
            }
        });
        this.peerConnections.clear();
        
        if (this.consumerPcMapping) {
            this.consumerPcMapping.forEach(pc => {
                if (pc && pc.connectionState !== 'closed') {
                    pc.close();
                }
            });
            this.consumerPcMapping.clear();
        }
        
        if (this.producerPendingIce) {
            this.producerPendingIce.clear();
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.producers.clear();
        this.consumers.clear();
        
        if (this.pendingIceCandidates) {
            this.pendingIceCandidates.clear();
        }
        
        if (this.producerTracks) {
            this.producerTracks.clear();
        }
        
        this.currentRoomId = null;

        await this.connection.invoke('LeaveStream', roomId, isHostLeaving);
    }

    async endStream(roomId) {
        await this.connection.invoke('EndStream', roomId);
    }

    async handleOfferFromConsumer(data) {
        const { consumerUserId, consumerConnectionId, offer } = data;
        
        try {
            console.log(`Received offer from consumer ${consumerUserId}`, offer);
            
            const pc = new RTCPeerConnection(this.configuration);

            if (!this.producerPendingIce) {
                this.producerPendingIce = new Map();
            }
            this.producerPendingIce.set(consumerConnectionId, {
                candidates: [],
                remoteDescriptionSet: false
            });

            if (this.localStream) {
                console.log('Adding tracks to peer connection:', this.localStream.getTracks().length);
                this.localStream.getTracks().forEach(track => {
                    console.log(`Adding ${track.kind} track:`, track.id);
                    pc.addTrack(track, this.localStream);
                });
            } else {
                console.error('No local stream available to send to consumer!');
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate to consumer');
                    this.connection.invoke('SendIceCandidateToConsumer', this.currentRoomId, consumerConnectionId, {
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex
                    }).catch(console.error);
                }
            };

            pc.onconnectionstatechange = () => {
                console.log(`Connection state to consumer ${consumerConnectionId}:`, pc.connectionState);
            };

            pc.oniceconnectionstatechange = () => {
                console.log(`ICE connection state to consumer ${consumerConnectionId}:`, pc.iceConnectionState);
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('Set remote description (offer)');
            
            const pending = this.producerPendingIce.get(consumerConnectionId);
            if (pending) {
                pending.remoteDescriptionSet = true;
                
                console.log(`Processing ${pending.candidates.length} pending ICE candidates from consumer`);
                for (const candidate of pending.candidates) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('Added pending ICE candidate from consumer');
                    } catch (err) {
                        console.error('Error adding pending ICE candidate:', err);
                    }
                }
                pending.candidates = [];
            }

            const answer = await pc.createAnswer();
            
            answer.sdp = this.setOpusPreferred(answer.sdp);
            answer.sdp = this.setAudioBitrate(answer.sdp, 128);
            
            await pc.setLocalDescription(answer);
            console.log('Created and set local description (answer)');

            await new Promise((resolve) => {
                if (pc.iceGatheringState === 'complete') {
                    console.log('ICE gathering already complete');
                    resolve();
                } else {
                    console.log('Waiting for ICE gathering...');
                    const timeout = setTimeout(() => {
                        console.log('ICE gathering timeout - proceeding anyway');
                        resolve();
                    }, 3000);
                    
                    pc.addEventListener('icegatheringstatechange', () => {
                        console.log('ICE gathering state:', pc.iceGatheringState);
                        if (pc.iceGatheringState === 'complete') {
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                }
            });

            await this.connection.invoke('SendAnswerToConsumer', this.currentRoomId, consumerConnectionId, {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp
            });
            console.log('Sent answer to consumer');

            this.peerConnections.set(`to-consumer-${consumerConnectionId}`, pc);

        } catch (err) {
            console.error('Error handling offer from consumer:', err);
        }
    }

    async handleAnswerFromProducer(data) {
        const { producerUserId, answer } = data;
        
        try {
            console.log(`Received answer from producer ${producerUserId}`);
            
            const pc = this.consumerPcMapping?.get(producerUserId);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('Answer set successfully');
                
                if (this.pendingIceCandidates) {
                    const pending = this.pendingIceCandidates.get(producerUserId);
                    if (pending) {
                        pending.remoteDescriptionSet = true;
                        console.log(`Processing ${pending.candidates.length} pending ICE candidates`);
                        
                        for (const candidate of pending.candidates) {
                            try {
                                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                                console.log('Added pending ICE candidate');
                            } catch (err) {
                                console.error('Error adding pending ICE candidate:', err);
                            }
                        }
                        
                        pending.candidates = [];
                    }
                }
            } else {
                console.error('No peer connection found for producer:', producerUserId);
            }
        } catch (err) {
            console.error('Error handling answer from producer:', err);
        }
    }

    async handleIceCandidateFromConsumer(data) {
        const { consumerConnectionId, candidate } = data;
        
        try {
            const pc = this.peerConnections.get(`to-consumer-${consumerConnectionId}`);
            if (pc && candidate.candidate) {
                const pending = this.producerPendingIce?.get(consumerConnectionId);
                
                if (pending && !pending.remoteDescriptionSet) {
                    console.log('Queueing ICE candidate from consumer (waiting for remote description)');
                    pending.candidates.push(candidate);
                } else {
                    console.log('Adding ICE candidate from consumer');
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
        } catch (err) {
            console.error('Error adding ICE candidate from consumer:', err);
        }
    }

    async handleIceCandidateFromProducer(data) {
        const { producerUserId, candidate } = data;
        
        try {
            const pc = this.consumerPcMapping?.get(producerUserId);
            if (pc && candidate.candidate) {
                const pending = this.pendingIceCandidates?.get(producerUserId);
                
                if (pending && !pending.remoteDescriptionSet) {
                    console.log('Queueing ICE candidate (waiting for remote description)');
                    pending.candidates.push(candidate);
                } else {
                    console.log('Adding ICE candidate from producer');
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
        } catch (err) {
            console.error('Error adding ICE candidate from producer:', err);
        }
    }

onStreamStarted(data) {}
onJoinedStream(data) {}
onUserJoined(data) {}
onUserLeft(data) {}
onMessageReceived(data) {}
onStreamEnded(data) {}
onError(data) {}
onProducerPaused(data) {}
onProducerResumed(data) {}
onProducerClosed(data) {}
onNewProducer(data) {}
onRemoteStream(stream, producerId, kind) {
    console.log('Received remote stream:', { producerId, kind });
}
onCoHostInvite(data) {}
onCoHostAdded(data) {}
onCoHostRemoved(data) {}
onCoHostLeft(data) {}
onCoHostMediaRemoved(data) {} 
onUserRemoved(data) {}
onUserBlocked(data) {}

    disconnect() {
        if (this.connection) {
            this.connection.stop();
        }
    }
    
    setOpusPreferred(sdp) {
        const lines = sdp.split('\r\n');
        const mLineIndex = lines.findIndex(line => line.startsWith('m=audio'));
        if (mLineIndex === -1) return sdp;
        
        const codecPattern = /a=rtpmap:(\d+) opus\/48000/;
        let opusPayloadType = null;
        
        for (let i = mLineIndex; i < lines.length; i++) {
            const match = lines[i].match(codecPattern);
            if (match) {
                opusPayloadType = match[1];
                break;
            }
            if (lines[i].startsWith('m=')) break;
        }
        
        if (opusPayloadType) {
            const mLine = lines[mLineIndex];
            const parts = mLine.split(' ');
            const codecs = parts.slice(3);
            const newCodecs = [opusPayloadType, ...codecs.filter(c => c !== opusPayloadType)];
            lines[mLineIndex] = parts.slice(0, 3).join(' ') + ' ' + newCodecs.join(' ');
        }
        
        return lines.join('\r\n');
    }
    
    setAudioBitrate(sdp, bitrate) {
        const lines = sdp.split('\r\n');
        let mLineIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('m=audio')) {
                mLineIndex = i;
                break;
            }
        }
        
        if (mLineIndex === -1) return sdp;
        
        let opusPayloadType = null;
        for (let i = mLineIndex; i < lines.length; i++) {
            const match = lines[i].match(/a=rtpmap:(\d+) opus\/48000/);
            if (match) {
                opusPayloadType = match[1];
                break;
            }
            if (lines[i].startsWith('m=')) break;
        }
        
        if (opusPayloadType) {
            let fmtpLineIndex = -1;
            for (let i = mLineIndex; i < lines.length; i++) {
                if (lines[i].startsWith(`a=fmtp:${opusPayloadType}`)) {
                    fmtpLineIndex = i;
                    break;
                }
                if (lines[i].startsWith('m=')) break;
            }
            
            const bitrateKbps = bitrate * 1000;
            if (fmtpLineIndex !== -1) {
                if (!lines[fmtpLineIndex].includes('maxaveragebitrate')) {
                    lines[fmtpLineIndex] += `;maxaveragebitrate=${bitrateKbps}`;
                }
                if (!lines[fmtpLineIndex].includes('stereo')) {
                    lines[fmtpLineIndex] += ';stereo=0';
                }
                if (!lines[fmtpLineIndex].includes('useinbandfec')) {
                    lines[fmtpLineIndex] += ';useinbandfec=1';
                }
            } else {
                for (let i = mLineIndex; i < lines.length; i++) {
                    if (lines[i].startsWith(`a=rtpmap:${opusPayloadType}`)) {
                        lines.splice(i + 1, 0, `a=fmtp:${opusPayloadType} maxaveragebitrate=${bitrateKbps};stereo=0;useinbandfec=1`);
                        break;
                    }
                    if (lines[i].startsWith('m=')) break;
                }
            }
        }
        
        return lines.join('\r\n');
    }
}