package de.by_m.klingeltonersteller

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

/**
 * Kopiert nur die ersten Sekunden der Tonspur eines Videos in eine kleine Audiodatei,
 * ohne neu zu kodieren. So muss die Web-Oberfläche nicht das ganze (oft hunderte MB
 * große) Video in den Speicher laden, sondern nur ein paar hundert KB.
 */
object AudioTrimmer {
    private const val TAG = "AudioTrimmer"

    /** Ergebnis: Datei mit der gekürzten Tonspur oder null, wenn das Format nicht passt. */
    fun trimAudio(context: Context, uri: Uri, outDir: File, maxDurationUs: Long): File? {
        val extractor = MediaExtractor()
        var outFile: File? = null
        try {
            extractor.setDataSource(context, uri, null)

            val trackIndex = (0 until extractor.trackCount).firstOrNull { i ->
                extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return null

            val format = extractor.getTrackFormat(trackIndex)
            val (muxerFormat, ext) = when (format.getString(MediaFormat.KEY_MIME)) {
                MediaFormat.MIMETYPE_AUDIO_AAC -> MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4 to "m4a"
                MediaFormat.MIMETYPE_AUDIO_OPUS,
                MediaFormat.MIMETYPE_AUDIO_VORBIS -> MediaMuxer.OutputFormat.MUXER_OUTPUT_WEBM to "webm"
                else -> return null
            }

            extractor.selectTrack(trackIndex)
            val file = File(outDir, "audio_${System.nanoTime()}.$ext")
            outFile = file

            val muxer = MediaMuxer(file.path, muxerFormat)
            var written = 0
            try {
                val outTrack = muxer.addTrack(format)
                muxer.start()

                val bufferSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                    format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE).coerceAtLeast(64 * 1024)
                } else {
                    1024 * 1024
                }
                val buffer = ByteBuffer.allocate(bufferSize)
                val info = MediaCodec.BufferInfo()
                var firstTimeUs = -1L

                while (true) {
                    val size = extractor.readSampleData(buffer, 0)
                    if (size < 0) break
                    val timeUs = extractor.sampleTime
                    if (firstTimeUs < 0) firstTimeUs = timeUs
                    if (timeUs - firstTimeUs > maxDurationUs) break

                    info.set(
                        0,
                        size,
                        timeUs - firstTimeUs,
                        if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) {
                            MediaCodec.BUFFER_FLAG_KEY_FRAME
                        } else {
                            0
                        }
                    )
                    muxer.writeSampleData(outTrack, buffer, info)
                    written++
                    if (!extractor.advance()) break
                }
                muxer.stop()
            } finally {
                muxer.release()
            }

            return if (written > 0) file else {
                file.delete()
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Tonspur konnte nicht direkt kopiert werden, nutze Originaldatei", e)
            outFile?.delete()
            return null
        } finally {
            extractor.release()
        }
    }
}
